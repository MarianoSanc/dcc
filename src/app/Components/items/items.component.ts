import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DccDataService } from '../../services/dcc-data.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-items',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './items.component.html',
  styleUrl: './items.component.css',
})
export class ItemsComponent implements OnInit, OnDestroy {
  items: any[] = [];
  objectData: any = {};
  objectIdentifications: any[] = [];
  editingItem: string | null = null;
  editingBlocks: Set<string> = new Set();
  private subscription: Subscription = new Subscription();
  objectIdentificationGroups: any[][] = [];

  constructor(private dccDataService: DccDataService) {}

  ngOnInit() {
    this.subscription.add(
      this.dccDataService.dccData$.subscribe((data) => {
        this.items = data.items || [];
        this.objectIdentifications = data.objectIdentifications || [];
        this.objectData = this.getObjectData(
          data.administrativeData.identifications
        );

        // Apply naming logic on load
        this.renumberAllGroups();
        this.updateObjectIdentificationGroups();
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  // Helper method to get object data
  getObjectData(identifications: any[]): any {
    const objectItem = identifications?.find((item) => item.name === 'Object');
    return objectItem || { value: 'No especificado' };
  }

  // Object block editing methods
  toggleEdit(blockName: string) {
    if (this.editingBlocks.has(blockName)) {
      this.editingBlocks.delete(blockName);
    } else {
      this.editingBlocks.add(blockName);
    }
  }

  isEditing(blockName: string): boolean {
    return this.editingBlocks.has(blockName);
  }

  saveBlock(blockType: string) {
    if (blockType === 'object-identifications') {
      this.dccDataService.updateObjectIdentifications(
        this.objectIdentifications
      );
      this.updateObjectIdentificationGroups();
    }
    this.editingBlocks.delete(blockType);
  }

  cancelEdit(blockName: string) {
    this.editingBlocks.delete(blockName);
    // Reload data from service to revert changes
    const currentData = this.dccDataService.getCurrentData();
    if (blockName === 'object-identifications') {
      this.objectIdentifications = currentData.objectIdentifications
        ? [...currentData.objectIdentifications]
        : [];
      this.updateObjectIdentificationGroups();
    }
  }

  // Object identifications methods
  addObjectIdentification() {
    const nextGroupIndex = Math.floor(this.objectIdentifications.length / 3);
    const groupName = this.getDefaultGroupName(nextGroupIndex);

    const newGroup = [
      {
        issuer: 'manufacturer',
        value: '',
        name: 'Assigned measurement range(s) [kV]',
        groupName: groupName,
        groupIndex: nextGroupIndex,
      },
      {
        issuer: 'manufacturer',
        value: '',
        name: 'Assigned scale factor(s)',
        groupName: groupName,
        groupIndex: nextGroupIndex,
      },
      {
        issuer: 'manufacturer',
        value: '',
        name: 'Rated frequency [Hz]',
        groupName: groupName,
        groupIndex: nextGroupIndex,
      },
    ];

    this.objectIdentifications.push(...newGroup);
    this.renumberAllGroups();
    this.updateObjectIdentificationGroups();
  }

  removeObjectIdentificationGroup(groupIndex: number) {
    const startIndex = groupIndex * 3;
    this.objectIdentifications.splice(startIndex, 3);
    this.renumberAllGroups();
    this.updateObjectIdentificationGroups();
  }

  private getDefaultGroupName(groupIndex: number): string {
    const totalGroups = Math.ceil(this.objectIdentifications.length / 3) + 1;

    if (totalGroups === 1) {
      return 'Grupo 1';
    } else if (totalGroups === 2) {
      return groupIndex === 0 ? 'BEFORE ADJUSTMENT' : 'AFTER ADJUSTMENT';
    } else {
      return `Grupo ${groupIndex + 1}`;
    }
  }

  private renumberAllGroups() {
    const totalGroups = Math.ceil(this.objectIdentifications.length / 3);

    this.objectIdentifications.forEach((item, index) => {
      const newGroupIndex = Math.floor(index / 3);
      item.groupIndex = newGroupIndex;

      // Apply naming logic based on total number of groups
      if (totalGroups === 1) {
        item.groupName = 'Grupo 1';
      } else if (totalGroups === 2) {
        item.groupName =
          newGroupIndex === 0 ? 'BEFORE ADJUSTMENT' : 'AFTER ADJUSTMENT';
      } else {
        // For 3 or more groups, check if it was a special name and preserve it or use default numbering
        if (
          item.groupName === 'BEFORE ADJUSTMENT' ||
          item.groupName === 'AFTER ADJUSTMENT'
        ) {
          item.groupName = `Grupo ${newGroupIndex + 1}`;
        } else if (!item.groupName || item.groupName.startsWith('Grupo ')) {
          item.groupName = `Grupo ${newGroupIndex + 1}`;
        }
        // If it has a custom name, preserve it
      }
    });
  }

  updateGroupName(groupIndex: number, newName: string) {
    const startIndex = groupIndex * 3;
    for (
      let i = startIndex;
      i < startIndex + 3 && i < this.objectIdentifications.length;
      i++
    ) {
      this.objectIdentifications[i].groupName = newName;
    }
  }

  private updateObjectIdentificationGroups() {
    this.objectIdentificationGroups = [];
    for (let i = 0; i < this.objectIdentifications.length; i += 3) {
      this.objectIdentificationGroups.push(
        this.objectIdentifications.slice(i, i + 3)
      );
    }
  }

  getGroupedObjectIdentifications() {
    const grouped: { [key: string]: any[] } = {};

    this.objectIdentifications.forEach((item) => {
      const groupName = item.groupName || `Grupo ${(item.groupIndex || 0) + 1}`;
      if (!grouped[groupName]) {
        grouped[groupName] = [];
      }
      grouped[groupName].push(item);
    });

    return grouped;
  }

  // Items methods
  addItem() {
    const newItem = {
      id: this.generateId(),
      name: '',
      model: '',
      manufacturer: '',
      identifications: [{ issuer: '', value: '', name: '' }],
    };
    this.items.push(newItem);
    this.editingItem = newItem.id;
  }

  editItem(itemId: string) {
    this.editingItem = itemId;
  }

  saveItem(itemId: string) {
    this.editingItem = null;
    this.dccDataService.updateItems(this.items);
  }

  cancelEditItem(itemId: string) {
    const item = this.items.find((item) => item.id === itemId);
    if (item && !item.name) {
      // Remove item if it's new and empty
      this.removeItem(itemId);
    } else {
      // Reload data from service
      const currentData = this.dccDataService.getCurrentData();
      this.items = [...currentData.items];
    }
    this.editingItem = null;
  }

  removeItem(itemId: string) {
    this.items = this.items.filter((item) => item.id !== itemId);
    this.dccDataService.updateItems(this.items);
  }

  isEditingItem(itemId: string): boolean {
    return this.editingItem === itemId;
  }

  // Item identifications methods
  addItemIdentification(itemIndex: number) {
    this.items[itemIndex].identifications.push({
      issuer: '',
      value: '',
      name: '',
    });
  }

  removeItemIdentification(itemIndex: number, identificationIndex: number) {
    this.items[itemIndex].identifications.splice(identificationIndex, 1);
  }

  private generateId(): string {
    return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
