import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { v4 as uuidv4 } from 'uuid';
import type { AuthRequest } from '../types/index.js';

const router = Router();

router.use(authenticate);
router.use(aiRateLimiter);

// POST /api/ai/estimate - Get cost estimate from AI
router.post('/estimate', async (req: AuthRequest, res, next) => {
  try {
    const { description, city, projectType } = req.body;
    
    if (!description) {
      res.status(400).json({
        status: 'error',
        message: 'Description is required',
      });
      return;
    }
    
    // TODO: Implement actual AI integration
    // For now, return a mock response
    
    const estimate = {
      id: uuidv4(),
      description,
      city: city || 'Москва',
      projectType: projectType || 'standard',
      estimatedCost: {
        min: 15000,
        max: 25000,
        currency: 'RUB',
      },
      works: [
        { name: 'Демонтаж', unit: 'м²', quantity: 20, price: 500 },
        { name: 'Выравнивание стен', unit: 'м²', quantity: 50, price: 600 },
        { name: 'Покраска', unit: 'м²', quantity: 50, price: 350 },
      ],
      materials: [
        { name: 'Штукатурка', unit: 'кг', quantity: 100, price: 150 },
        { name: 'Грунтовка', unit: 'л', quantity: 10, price: 300 },
        { name: 'Краска', unit: 'л', quantity: 15, price: 500 },
      ],
      generatedAt: new Date().toISOString(),
    };
    
    res.json({
      status: 'success',
      data: estimate,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/suggest-materials - Get material suggestions
router.post('/suggest-materials', async (req: AuthRequest, res, next) => {
  try {
    const { workName, area, city } = req.body;
    
    if (!workName) {
      res.status(400).json({
        status: 'error',
        message: 'Work name is required',
      });
      return;
    }
    
    // TODO: Implement actual AI integration
    
    const suggestions = {
      workName,
      area: area || 0,
      city: city || 'Москва',
      materials: [
        {
          name: 'Грунтовка глубокого проникновения',
          quantity: Math.ceil((area || 50) * 0.1),
          unit: 'л',
          pricePerUnit: 280,
          coverage: '10 м²/л',
        },
        {
          name: 'Краска водоэмульсионная',
          quantity: Math.ceil((area || 50) * 0.15),
          unit: 'л',
          pricePerUnit: 450,
          coverage: '6-7 м²/л в 2 слоя',
        },
      ],
      tools: [
        { name: 'Валик малярный', quantity: 2, price: 250, isRent: false },
        { name: 'Кювета для краски', quantity: 1, price: 150, isRent: false },
      ],
      generatedAt: new Date().toISOString(),
    };
    
    res.json({
      status: 'success',
      data: suggestions,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/generate-template - Generate work template for room type
router.post('/generate-template', async (req: AuthRequest, res, next) => {
  try {
    const { roomType, area, city } = req.body;
    
    if (!roomType) {
      res.status(400).json({
        status: 'error',
        message: 'Room type is required',
      });
      return;
    }
    
    // TODO: Implement actual AI integration
    
    const templates: Record<string, { works: unknown[] }> = {
      bathroom: {
        works: [
          { name: 'Демонтаж старой плитки', unit: 'м²', calculationType: 'floorArea', workUnitPrice: 450 },
          { name: 'Выравнивание стен', unit: 'м²', calculationType: 'netWallArea', workUnitPrice: 550 },
          { name: 'Гидроизоляция', unit: 'м²', calculationType: 'floorArea', workUnitPrice: 350 },
          { name: 'Укладка плитки на пол', unit: 'м²', calculationType: 'floorArea', workUnitPrice: 1200 },
          { name: 'Укладка плитки на стены', unit: 'м²', calculationType: 'netWallArea', workUnitPrice: 1300 },
          { name: 'Установка сантехники', unit: 'точка', calculationType: 'customCount', workUnitPrice: 3500 },
        ],
      },
      kitchen: {
        works: [
          { name: 'Выравнивание стен', unit: 'м²', calculationType: 'netWallArea', workUnitPrice: 550 },
          { name: 'Укладка напольной плитки', unit: 'м²', calculationType: 'floorArea', workUnitPrice: 1100 },
          { name: 'Монтаж фартука', unit: 'м²', calculationType: 'customCount', workUnitPrice: 1500 },
          { name: 'Установка розеток', unit: 'шт', calculationType: 'customCount', workUnitPrice: 500 },
        ],
      },
      bedroom: {
        works: [
          { name: 'Выравнивание стен', unit: 'м²', calculationType: 'netWallArea', workUnitPrice: 500 },
          { name: 'Покраска стен', unit: 'м²', calculationType: 'netWallArea', workUnitPrice: 350 },
          { name: 'Укладка ламината', unit: 'м²', calculationType: 'floorArea', workUnitPrice: 600 },
          { name: 'Монтаж плинтуса', unit: 'м.п.', calculationType: 'skirtingLength', workUnitPrice: 150 },
          { name: 'Натяжной потолок', unit: 'м²', calculationType: 'floorArea', workUnitPrice: 650 },
        ],
      },
    };
    
    const template = templates[roomType] || templates.bedroom;
    
    res.json({
      status: 'success',
      data: {
        roomType,
        area: area || 0,
        city: city || 'Москва',
        ...template,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;