import type { WorkTemplate } from '../types/workTemplate';
import type { IStorageProvider } from '../types/storage';
import { StorageProviderError } from '../types/storage';
import { LocalStorageProvider } from './localStorageProvider';
import { STORAGE_KEYS } from './storage';

/**
 * Storage utilities for work templates with pluggable storage provider
 */
export class TemplateStorage {
  private static provider: IStorageProvider = LocalStorageProvider.getInstance();

  /**
   * Set a custom storage provider (useful for testing or different storage backends)
   */
  static setProvider(provider: IStorageProvider): void {
    TemplateStorage.provider = provider;
  }

  /**
   * Get current storage provider
   */
  static getProvider(): IStorageProvider {
    return TemplateStorage.provider;
  }

  /**
   * Load all templates from storage
   */
  static loadTemplates(): WorkTemplate[] {
    try {
      const templates = TemplateStorage.provider.get<WorkTemplate[]>(STORAGE_KEYS.WORK_TEMPLATES);
      
      if (!templates) return [];
      
      // Validate structure
      if (!Array.isArray(templates)) {
        console.error('Invalid templates data structure');
        return [];
      }
      
      return templates;
    } catch (error) {
      console.error('Error loading templates:', error);
      return [];
    }
  }

  /**
   * Save all templates to storage
   */
  static saveTemplates(templates: WorkTemplate[]): void {
    try {
      TemplateStorage.provider.set(STORAGE_KEYS.WORK_TEMPLATES, templates);
    } catch (error) {
      if (error instanceof StorageProviderError && error.type === 'quota_exceeded') {
        throw new Error('Превышен лимит хранилища. Удалите ненужные шаблоны.');
      }
      throw error;
    }
  }

  /**
   * Add a new template
   */
  static addTemplate(template: WorkTemplate): WorkTemplate[] {
    const templates = this.loadTemplates();
    templates.push(template);
    this.saveTemplates(templates);
    return templates;
  }

  /**
   * Update an existing template by id
   */
  static updateTemplate(updatedTemplate: WorkTemplate): WorkTemplate[] {
    const templates = this.loadTemplates();
    const index = templates.findIndex(t => t.id === updatedTemplate.id);
    
    if (index !== -1) {
      templates[index] = {
        ...updatedTemplate,
        updatedAt: new Date().toISOString(),
      };
      this.saveTemplates(templates);
    }
    
    return templates;
  }

  /**
   * Update or add template by name (for replace functionality)
   */
  static upsertByName(template: WorkTemplate): WorkTemplate[] {
    const templates = this.loadTemplates();
    const existingIndex = templates.findIndex(
      t => t.name.toLowerCase() === template.name.toLowerCase()
    );
    
    if (existingIndex !== -1) {
      // Update existing
      templates[existingIndex] = {
        ...template,
        id: templates[existingIndex].id, // Keep original ID
        updatedAt: new Date().toISOString(),
        createdAt: templates[existingIndex].createdAt, // Keep original creation date
      };
    } else {
      // Add new
      templates.push(template);
    }
    
    this.saveTemplates(templates);
    return templates;
  }

  /**
   * Delete a template by id
   */
  static deleteTemplate(id: string): WorkTemplate[] {
    const templates = this.loadTemplates();
    const filtered = templates.filter(t => t.id !== id);
    this.saveTemplates(filtered);
    return filtered;
  }

  /**
   * Find template by name (case-insensitive)
   */
  static findByName(name: string): WorkTemplate | undefined {
    const templates = this.loadTemplates();
    return templates.find(t => t.name.toLowerCase() === name.toLowerCase());
  }

  /**
   * Check if template with name exists
   */
  static existsByName(name: string): boolean {
    return this.findByName(name) !== undefined;
  }

  /**
   * Search templates by name (case-insensitive substring match)
   */
  static searchByName(query: string): WorkTemplate[] {
    const templates = this.loadTemplates();
    if (!query.trim()) return templates;
    
    const lowerQuery = query.toLowerCase();
    return templates.filter(t => 
      t.name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Filter templates by category
   */
  static filterByCategory(category: WorkTemplate['category'] | 'all'): WorkTemplate[] {
    const templates = this.loadTemplates();
    if (category === 'all') return templates;
    
    return templates.filter(t => t.category === category);
  }

  /**
   * Search and filter templates
   */
  static searchAndFilter(
    query: string,
    category: WorkTemplate['category'] | 'all'
  ): WorkTemplate[] {
    let templates = this.loadTemplates();
    
    // Filter by category first
    if (category !== 'all') {
      templates = templates.filter(t => t.category === category);
    }
    
    // Then search by name
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(lowerQuery)
      );
    }
    
    return templates;
  }

  /**
   * Clear all templates
   */
  static clearTemplates(): void {
    TemplateStorage.provider.remove(STORAGE_KEYS.WORK_TEMPLATES);
  }
}