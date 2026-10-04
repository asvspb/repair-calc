/**
 * Фасад репозиториев комнат.
 *
 * Реализация разнесена по внутренней связности:
 *  - `roomRead.ts`     — чтение комнат;
 *  - `roomWrite.ts`    — запись/жизненный цикл комнат;
 *  - `roomWorks.ts`    — проёмы (openings) и подсекции (subsections);
 *  - `roomGeometry.ts` — сегменты, препятствия и секции стен (advanced-режим).
 *
 * Публичный контракт (имена классов, сигнатуры, SQL) сохранён — импортёры не правятся.
 */

import { findRoomById, findRoomByIdWithObject, findRoomsByProjectId } from './roomRead.js';
import {
  createRoom,
  createRoomForObject,
  deleteRoom,
  reorderRooms,
  updateRoom,
} from './roomWrite.js';

export { OpeningRepository, SubSectionRepository } from './roomWorks.js';
export { ObstacleRepository, SegmentRepository, WallSectionRepository } from './roomGeometry.js';

export class RoomRepository {
  /** @deprecated Используйте createForObject */
  static create = createRoom;
  static createForObject = createRoomForObject;
  static findById = findRoomById;
  static findByProjectId = findRoomsByProjectId;
  static update = updateRoom;
  static delete = deleteRoom;
  static reorder = reorderRooms;
  /** Поиск комнаты со всеми данными из JSON-полей. */
  static findFullRoom = (id: string) => findRoomById(id);
  static findByIdWithObject = findRoomByIdWithObject;
}
