import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { syncPushSchema } from '../middleware/validation.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import { ObjectRepository } from '../db/repositories/object.repo.js';
import { RoomRepository } from '../db/repositories/room.repo.js';
import { transaction } from '../db/pool.js';
import type { AuthRequest, Conflict, ChangeLogEntry, Room } from '../types/index.js';
import type { RowDataPacket } from 'mysql2/promise';

const router = Router();

// Middleware для детального логирования всех запросов
router.use((req, res, next) => {
  const userId = (req as AuthRequest).user?.id || 'ANONYMOUS';
  const method = req.method;
  const path = req.path;
  const timestamp = new Date().toISOString();
  
  console.log('\n' + '='.repeat(80));
  console.log(`📡 [${timestamp}] API ЗАПРОС`);
  console.log('='.repeat(80));
  console.log(`   Метод: ${method}`);
  console.log(`   Путь: ${path}`);
  console.log(`   Пользователь: ${userId}`);
  
  if (method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
    console.log(`   Тело запроса:`, JSON.stringify(req.body, null, 2).substring(0, 1000));
  }
  
  next();
});

router.use(authenticate);

/**
 * POST /api/sync/push - Push local changes to server
 * Implements last-write-wins conflict resolution with version checking
 */
router.post('/push', async (req: AuthRequest, res, next) => {
  const userId = req.user!.id;
  const startTime = Date.now();
  
  try {
    const { changes } = syncPushSchema.parse(req.body);
    
    console.log(`\n🔄 [SYNC/PUSH] Начало синхронизации`);
    console.log(`   Изменений: ${changes.length}`);
    
    const synced: string[] = [];
    const conflicts: Conflict[] = [];

    // Process each change
    for (const change of changes) {
      try {
        const changeData = change as ChangeLogEntry & { id: string };
        const { id, entity, entityId, data, timestamp } = changeData;
        const clientVersion = (data as { version?: number })?.version ?? 0;
        const roomData = data as Partial<Room>;
        const projectData = data as { name?: string; city?: string; use_ai_pricing?: boolean };

        if (entity === 'project') {
          console.log(`\n   📁 Проект: ${entityId}`);
          console.log(`      Действие: ${projectData.name ? 'Обновление' : 'Пропуск'}`);
          console.log(`      Название: ${projectData.name || 'N/A'}`);
          console.log(`      Город: ${projectData.city || 'не указан'}`);
          
          const serverProject = await ObjectRepository.findByIdAndUserId(entityId, userId);

          if (!serverProject) {
            console.log(`      ⚠️ Проект не найден на сервере`);
            conflicts.push({
              id,
              entity: 'project',
              entityId,
              serverVersion: 0,
              clientVersion,
            });
            continue;
          }

          const serverVersion = serverProject.version;
          
          if (clientVersion && clientVersion < serverVersion) {
            console.log(`      ⚠️ Конфликт версий (клиент: ${clientVersion}, сервер: ${serverVersion})`);
            conflicts.push({
              id,
              entity: 'project',
              entityId,
              serverVersion,
              clientVersion,
            });
            continue;
          }

          const updateData: Partial<typeof serverProject> = {};
          if (projectData.name !== undefined) updateData.name = projectData.name;
          if (projectData.city !== undefined) updateData.city = projectData.city;
          if (projectData.use_ai_pricing !== undefined) updateData.use_ai_pricing = projectData.use_ai_pricing;

          await ProjectRepository.update(entityId, updateData);
          synced.push(id);
          console.log(`      ✅ Обновлён`);
          
        } else if (entity === 'room') {
          console.log(`\n   🏠 Комната: ${entityId}`);
          console.log(`      Название: ${roomData.name || 'N/A'}`);
          console.log(`      Размеры: ${roomData.length}×${roomData.width}×${roomData.height}`);
          console.log(`      Работ: ${roomData.works?.length || 0}`);
          
          const serverRoom = await RoomRepository.findById(entityId);

          if (!serverRoom) {
            if (!roomData.object_id) {
              console.log(`      ❌ Ошибка: нет project_id`);
              throw new Error('project_id is required for room creation');
            }
            const roomId = await RoomRepository.create(roomData.object_id, roomData);
            synced.push(roomId.id);
            console.log(`      ✅ Создана`);
            continue;
          }

          const project = await ObjectRepository.findByIdAndUserId(serverRoom.object_id, userId);
          if (!project) {
            console.log(`      ❌ Проект не найден`);
            conflicts.push({
              id,
              entity: 'room',
              entityId,
              serverVersion: 0,
              clientVersion,
            });
            continue;
          }

          const serverVersion = serverRoom.version ?? 0;
          if (clientVersion && clientVersion < serverVersion) {
            console.log(`      ⚠️ Конфликт версий`);
            conflicts.push({
              id,
              entity: 'room',
              entityId,
              serverVersion,
              clientVersion,
            });
            continue;
          }

          const updateData: Partial<typeof serverRoom> = {};
          if (roomData.name !== undefined) updateData.name = roomData.name;
          if (roomData.geometry_mode !== undefined) updateData.geometry_mode = roomData.geometry_mode;
          if (roomData.length !== undefined) updateData.length = roomData.length;
          if (roomData.width !== undefined) updateData.width = roomData.width;
          if (roomData.height !== undefined) updateData.height = roomData.height;
          if (roomData.segments !== undefined) updateData.segments = roomData.segments;
          if (roomData.obstacles !== undefined) updateData.obstacles = roomData.obstacles;
          if (roomData.wall_sections !== undefined) updateData.wall_sections = roomData.wall_sections;
          if (roomData.sub_sections !== undefined) updateData.sub_sections = roomData.sub_sections;
          if (roomData.windows !== undefined) updateData.windows = roomData.windows;
          if (roomData.doors !== undefined) updateData.doors = roomData.doors;
          if (roomData.works !== undefined) updateData.works = roomData.works;

          await RoomRepository.update(entityId, updateData);
          synced.push(id);
          console.log(`      ✅ Обновлена`);
          
        }
      } catch (error) {
        console.error('   ❌ Ошибка обработки изменения:', error);
        conflicts.push({
          id: change.id,
          entity: change.entity,
          entityId: change.entityId,
          serverVersion: 0,
          clientVersion: (change.data as { version?: number })?.version ?? 0,
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ [SYNC/PUSH] Завершено за ${duration}ms`);
    console.log(`   Успешно: ${synced.length}`);
    console.log(`   Конфликты: ${conflicts.length}`);

    res.json({
      status: 'success',
      data: {
        synced,
        conflicts,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`\n❌ [SYNC/PUSH] Ошибка за ${duration}ms:`, error);
    next(error);
  }
});

// GET /api/sync/pull - Pull changes from server
router.get('/pull', async (req: AuthRequest, res, next) => {
  const userId = req.user!.id;
  const startTime = Date.now();

  try {
    console.log(`\n📥 [SYNC/PULL] Загрузка данных пользователя`);
    console.log(`   Пользователь: ${userId}`);

    // Get all projects for user with objects
    const projects = await ProjectRepository.findAllByUserIdWithObjects(userId);

    // Подробное логирование каждого проекта
    console.log(`\n   📊 Найдено проектов: ${projects.length}`);

    for (const project of projects) {
      const totalRooms = project.objects?.reduce((sum, obj) => sum + (obj.rooms?.length || 0), 0) || 0;
      const totalWorks = project.objects?.reduce((sum, obj) => {
        return sum + (obj.rooms?.reduce((roomSum, room) => {
          const works = typeof room.works === 'string' ? JSON.parse(room.works) : room.works;
          return roomSum + (Array.isArray(works) ? works.filter((w: any) => w.enabled).length : 0);
        }, 0) || 0);
      }, 0) || 0;

      console.log(`\n   📁 ПРОЕКТ: "${project.name}"`);
      console.log(`      ID: ${project.id}`);
      console.log(`      Город: ${project.city || 'не указан'}`);
      console.log(`      AI Pricing: ${project.use_ai_pricing ? 'ВКЛ' : 'ВЫКЛ'}`);
      console.log(`      Объектов: ${project.objects?.length || 0}`);
      console.log(`      Комнат: ${totalRooms}`);
      console.log(`      Активных работ: ${totalWorks}`);

      if (project.objects && project.objects.length > 0) {
        for (const obj of project.objects) {
          console.log(`\n      ┌─ ОБЪЕКТ: "${obj.name}"`);
          console.log(`      │   ID: ${obj.id}`);
          console.log(`      │   Город: ${obj.city || 'не указан'}`);
          console.log(`      │   Комнат: ${obj.rooms?.length || 0}`);

          if (obj.rooms && obj.rooms.length > 0) {
            for (const room of obj.rooms) {
              const works = typeof room.works === 'string' ? JSON.parse(room.works) : room.works;
              const worksArray = Array.isArray(works) ? works : [];
              const enabledWorks = worksArray.filter((w: any) => w.enabled);

              const floorAreaRoom = room.length * room.width;
              const perimeter = (room.length + room.width) * 2;
              const grossWallArea = perimeter * room.height;

              // Parse windows and doors
              const windows = typeof room.windows === 'string' ? JSON.parse(room.windows) : room.windows;
              const doors = typeof room.doors === 'string' ? JSON.parse(room.doors) : room.doors;
              const windowsArray = Array.isArray(windows) ? windows : [];
              const doorsArray = Array.isArray(doors) ? doors : [];

              const windowsArea = windowsArray.reduce((sum: any, w: any) => sum + w.width * w.height, 0);
              const doorsArea = doorsArray.reduce((sum: any, d: any) => sum + d.width * d.height, 0);
              const netWallArea = grossWallArea - windowsArea - doorsArea;

              console.log(`      │   ┌─ 🏠 "${room.name}"`);
              console.log(`      │   │   ID: ${room.id}`);
              console.log(`      │   │   Режим: ${room.geometry_mode || 'simple'}`);
              console.log(`      │   │   Размеры: ${room.length}м × ${room.width}м × ${room.height}м`);
              console.log(`      │   │   Площадь пола: ${floorAreaRoom.toFixed(2)} м²`);
              console.log(`      │   │   Периметр: ${perimeter.toFixed(2)} м`);
              console.log(`      │   │   Стены (брутто): ${grossWallArea.toFixed(2)} м²`);
              console.log(`      │   │   Стены (нетто): ${netWallArea.toFixed(2)} м²`);
              console.log(`      │   │   Окна: ${windowsArray.length} шт. (${windowsArea.toFixed(2)} м²)`);
              console.log(`      │   │   Двери: ${doorsArray.length} шт. (${doorsArea.toFixed(2)} м²)`);
              console.log(`      │   │   Работ: ${enabledWorks.length}`);

              if (enabledWorks.length > 0) {
                console.log(`      │   │   ┌─ Список работ:`);
                enabledWorks.forEach((w: any, i: number) => {
                  const workTotal = w.work_unit_price * floorAreaRoom;
                  console.log(`      │   │   ├─ ${i + 1}. ${w.name} — ${workTotal.toFixed(2)} руб.`);
                });
                console.log(`      │   │   └─`);
              }
              console.log(`      │   └─`);
            }
          } else {
            console.log(`      │   ⚠️ КОМНАТ НЕТ`);
          }
          console.log(`      └─`);
        }
      } else {
        console.log(`      ⚠️ ОБЪЕКТОВ НЕТ`);
      }
    }

    const response = {
      status: 'success',
      data: {
        projects,
        timestamp: Date.now(),
      },
    };

    const duration = Date.now() - startTime;
    console.log(`\n✅ [SYNC/PULL] Завершено за ${duration}ms`);
    console.log(`   Размер ответа: ${JSON.stringify(response).length} байт`);

    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`\n❌ [SYNC/PULL] Ошибка за ${duration}ms:`, error);
    next(error);
  }
});

export default router;
