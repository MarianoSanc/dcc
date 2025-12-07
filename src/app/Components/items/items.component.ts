import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DccDataService } from '../../services/dcc-data.service';
import { ApiService } from '../../api/api.service';
import { UrlClass } from '../../shared/models/url.model';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-items',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './items.component.html',
  styleUrls: ['./items.component.css'],
})
export class ItemsComponent implements OnInit, OnDestroy {
  // ===== PROPIEDADES =====
  items: any[] = [];
  editingStates: { [key: string]: boolean } = {};
  private subscription = new Subscription();
  private database: string = 'calibraciones';

  // Variables para el control de edición del main item
  isEditingMainItem: boolean = false;

  private loadedDccId: string = '';

  constructor(
    private dccDataService: DccDataService,
    private apiService: ApiService
  ) {}

  // ===== LIFECYCLE HOOKS =====
  ngOnInit() {
    this.loadDccData();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  // ===== MÉTODOS DE CARGA DE DATOS =====
  private loadDccData() {
    this.subscription.add(
      this.dccDataService.dccData$.subscribe((data) => {
        const newDccId =
          data.administrativeData?.core?.certificate_number || '';

        if (this.loadedDccId !== newDccId) {
          this.loadedDccId = newDccId;
          this.items = data.items || [];
        }
      })
    );
  }

  // ===== GETTERS =====
  get mainItem() {
    return this.items[0] || { subItems: [] };
  }

  // ===== MÉTODOS DE CONTROL DE EDICIÓN =====
  isEditing(key: string): boolean {
    return this.editingStates[key] || false;
  }

  toggleEdit(key: string) {
    this.editingStates[key] = !this.editingStates[key];

    // Si estamos entrando en modo edición de subitems, cargar los identificadores desde la BD
    if (key === 'subitems' && this.editingStates[key]) {
      this.loadSubItemIdentifiersFromDB();
    }
  }

  saveBlock(blockName: string) {
    if (blockName === 'subitems') {
      this.saveSubItems();
    } else {
      this.editingStates[blockName] = false;
    }
  }

  cancelEdit(blockName: string) {
    this.loadDccData();
    this.editingStates[blockName] = false;
  }

  // ===== MAIN ITEM - GESTIÓN =====
  toggleEditMainItem() {
    this.isEditingMainItem = !this.isEditingMainItem;
    if (!this.isEditingMainItem) {
      this.loadDccData();
    }
  }

  saveMainItem() {
    const currentData = this.dccDataService.getCurrentData();

    if (!this.items || this.items.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se encontraron datos del item para actualizar.',
      });
      return;
    }

    const mainItem = this.items[0];
    const dccId = currentData.administrativeData.core.certificate_number;

    if (!dccId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se encontró el Certificate Number para actualizar.',
      });
      return;
    }

    Swal.fire({
      title: 'Guardando...',
      text: 'Actualizando información del main item',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    const updateMainItem = {
      action: 'update',
      bd: this.database,
      table: 'dcc_item',
      opts: {
        attributes: {
          object: mainItem.name || '',
          manufacturer: mainItem.manufacturer || '',
          model: mainItem.model || '',
          serial_number: mainItem.serialNumber || '',
          costumer_asset: mainItem.customerAssetId || '',
        },
        where: { id_dcc: dccId },
      },
    };

    this.apiService.post(updateMainItem, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        Swal.close();
        if (response.result) {
          this.dccDataService.updateItems(this.items);
          this.isEditingMainItem = false;
          Swal.fire({
            icon: 'success',
            title: '¡Guardado!',
            text: 'El main item se ha actualizado correctamente.',
            timer: 2000,
            showConfirmButton: false,
            position: 'top-end',
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al actualizar el main item.',
          });
        }
      },
      error: (error) => {
        Swal.close();
        console.error('Error updating main item:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error al actualizar el main item.',
        });
      },
    });
  }

  cancelMainItemEdit() {
    this.isEditingMainItem = false;
    this.loadDccData();
  }

  // ===== SUB ITEMS - GESTIÓN =====
  addSubItem() {
    const newSubItem = {
      id: null, // null indica que es nuevo y no tiene ID en BD
      dbId: null,
      name: '',
      model: '',
      manufacturer: '',
      identifiers: [], // Nueva estructura simplificada: {id, name, value}
    };

    if (!this.mainItem.subItems) {
      this.mainItem.subItems = [];
    }
    this.mainItem.subItems.push(newSubItem);
  }

  removeSubItem(index: number) {
    if (
      this.mainItem.subItems &&
      index >= 0 &&
      index < this.mainItem.subItems.length
    ) {
      const subItem = this.mainItem.subItems[index];

      // Si tiene dbId, marcarlo para eliminación
      if (subItem.dbId) {
        subItem._markedForDeletion = true;
      } else {
        // Si es nuevo (sin dbId), simplemente eliminarlo del array
        this.mainItem.subItems.splice(index, 1);
      }
    }
  }

  // ===== IDENTIFICADORES - GESTIÓN DINÁMICA =====
  addIdentifier(subItemIndex: number) {
    const subItem = this.mainItem.subItems[subItemIndex];
    if (!subItem) return;

    if (!subItem.identifiers) {
      subItem.identifiers = [];
    }

    subItem.identifiers.push({
      id: null, // null indica que es nuevo
      name: '',
      value: '',
    });

    this.items = [...this.items];
  }

  removeIdentifier(subItemIndex: number, identifierIndex: number) {
    const subItem = this.mainItem.subItems[subItemIndex];
    if (!subItem || !subItem.identifiers) return;

    const identifier = subItem.identifiers[identifierIndex];

    if (identifier.id) {
      // Si tiene ID en BD, marcarlo para eliminación
      identifier._markedForDeletion = true;
    } else {
      // Si es nuevo, eliminarlo directamente
      subItem.identifiers.splice(identifierIndex, 1);
    }

    this.items = [...this.items];
  }

  // ===== GUARDAR SUBITEMS =====
  saveSubItems() {
    const currentData = this.dccDataService.getCurrentData();
    const dccId = currentData.administrativeData.core.certificate_number;

    if (!dccId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se encontró el Certificate Number para actualizar.',
      });
      return;
    }

    if (!this.mainItem.subItems || this.mainItem.subItems.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin cambios',
        text: 'No hay subitems para guardar.',
      });
      return;
    }

    Swal.fire({
      title: 'Guardando...',
      text: 'Actualizando subitems e identificadores',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    this.processSubItemsSave(dccId);
  }

  private async processSubItemsSave(dccId: string) {
    try {
      const promises: Promise<any>[] = [];

      for (let i = 0; i < this.mainItem.subItems.length; i++) {
        const subItem = this.mainItem.subItems[i];

        // Si está marcado para eliminación
        if (subItem._markedForDeletion && subItem.dbId) {
          promises.push(this.deleteSubItem(subItem.dbId));
          continue;
        }

        // Crear o actualizar subitem
        if (subItem.dbId) {
          // Actualizar existente
          promises.push(
            this.updateSubItem(subItem).then((response: any) => {
              if (response?.result) {
                return this.saveIdentifiers(
                  subItem.dbId,
                  subItem.identifiers || []
                );
              }
              return response;
            })
          );
        } else {
          // Crear nuevo
          promises.push(
            this.createSubItem(dccId, subItem, i + 1).then((response: any) => {
              if (response?.result) {
                const newSubItemId = response.result;
                subItem.dbId = newSubItemId;
                return this.saveIdentifiers(
                  newSubItemId,
                  subItem.identifiers || []
                );
              }
              return response;
            })
          );
        }
      }

      await Promise.all(promises);

      // Limpiar subitems eliminados del array
      this.mainItem.subItems = this.mainItem.subItems.filter(
        (s: any) => !s._markedForDeletion
      );

      // Limpiar identificadores eliminados de cada subitem
      this.mainItem.subItems.forEach((subItem: any) => {
        if (subItem.identifiers) {
          subItem.identifiers = subItem.identifiers.filter(
            (id: any) => !id._markedForDeletion
          );
        }
      });

      Swal.close();
      this.dccDataService.updateItems(this.items);
      this.editingStates['subitems'] = false;

      Swal.fire({
        icon: 'success',
        title: '¡Guardado!',
        text: 'Los subitems se han actualizado correctamente.',
        timer: 2000,
        showConfirmButton: false,
        position: 'top-end',
      });
    } catch (error) {
      Swal.close();
      console.error('Error saving subitems:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al guardar los subitems.',
      });
    }
  }

  private createSubItem(
    dccId: string,
    subItem: any,
    idItem: number
  ): Promise<any> {
    const createRequest = {
      action: 'create',
      bd: this.database,
      table: 'dcc_subitem',
      opts: {
        attributes: {
          id_dcc: dccId,
          id_item: idItem,
          description: subItem.name || '',
          manufacturer: subItem.manufacturer || '',
          model: subItem.model || '',
        },
      },
    };

    return this.apiService.post(createRequest, UrlClass.URLNuevo).toPromise();
  }

  private updateSubItem(subItem: any): Promise<any> {
    const updateRequest = {
      action: 'update',
      bd: this.database,
      table: 'dcc_subitem',
      opts: {
        attributes: {
          description: subItem.name || '',
          manufacturer: subItem.manufacturer || '',
          model: subItem.model || '',
        },
        where: { id: subItem.dbId },
      },
    };

    return this.apiService.post(updateRequest, UrlClass.URLNuevo).toPromise();
  }

  private deleteSubItem(subItemId: number): Promise<any> {
    const deleteRequest = {
      action: 'update',
      bd: this.database,
      table: 'dcc_subitem',
      opts: {
        attributes: { deleted: 1 },
        where: { id: subItemId },
      },
    };

    return this.apiService.post(deleteRequest, UrlClass.URLNuevo).toPromise();
  }

  // ===== GUARDAR IDENTIFICADORES EN dcc_subitem_identificador =====
  private async saveIdentifiers(
    subItemId: number,
    identifiers: any[]
  ): Promise<void> {
    const promises: Promise<any>[] = [];

    for (const identifier of identifiers) {
      // Si está marcado para eliminación
      if (identifier._markedForDeletion && identifier.id) {
        promises.push(this.deleteIdentifier(identifier.id));
        continue;
      }

      // Solo guardar si tiene nombre
      if (!identifier.name || identifier.name.trim() === '') {
        continue;
      }

      if (identifier.id) {
        // Actualizar existente
        promises.push(this.updateIdentifierInDB(identifier));
      } else {
        // Crear nuevo
        promises.push(this.createIdentifier(subItemId, identifier));
      }
    }

    await Promise.all(promises);
  }

  private createIdentifier(subItemId: number, identifier: any): Promise<any> {
    const createRequest = {
      action: 'create',
      bd: this.database,
      table: 'dcc_subitem_identificador',
      opts: {
        attributes: {
          id_subitem: subItemId,
          name: identifier.name || '',
          value: identifier.value || '',
        },
      },
    };

    return this.apiService
      .post(createRequest, UrlClass.URLNuevo)
      .toPromise()
      .then((response: any) => {
        if (response?.result) {
          identifier.id = response.result;
        }
        return response;
      });
  }

  private updateIdentifierInDB(identifier: any): Promise<any> {
    const updateRequest = {
      action: 'update',
      bd: this.database,
      table: 'dcc_subitem_identificador',
      opts: {
        attributes: {
          name: identifier.name || '',
          value: identifier.value || '',
        },
        where: { id: identifier.id },
      },
    };

    return this.apiService.post(updateRequest, UrlClass.URLNuevo).toPromise();
  }

  private deleteIdentifier(identifierId: number): Promise<any> {
    const deleteRequest = {
      action: 'update',
      bd: this.database,
      table: 'dcc_subitem_identificador',
      opts: {
        attributes: { deleted: 1 },
        where: { id: identifierId },
      },
    };

    return this.apiService.post(deleteRequest, UrlClass.URLNuevo).toPromise();
  }

  // ===== CARGAR IDENTIFICADORES DESDE BD =====
  private loadSubItemIdentifiersFromDB() {
    const currentData = this.dccDataService.getCurrentData();
    const dccId = currentData.administrativeData.core.certificate_number;

    if (
      !dccId ||
      !this.mainItem.subItems ||
      this.mainItem.subItems.length === 0
    ) {
      return;
    }

    // Primero obtener los subitems de la BD para tener sus IDs
    this.checkExistingSubItems(dccId)
      .then((existingSubItems) => {
        // Mapear los dbId a los subitems locales
        existingSubItems.forEach((dbSubItem: any, index: number) => {
          if (this.mainItem.subItems[index]) {
            this.mainItem.subItems[index].dbId = dbSubItem.id;

            // Cargar identificadores para este subitem
            this.loadIdentifiersForSubItem(dbSubItem.id, index);
          }
        });
      })
      .catch((error) => {
        console.error('Error loading subitems:', error);
      });
  }

  private loadIdentifiersForSubItem(subItemId: number, subItemIndex: number) {
    const getIdentifiers = {
      action: 'get',
      bd: this.database,
      table: 'dcc_subitem_identificador',
      opts: {
        where: {
          id_subitem: subItemId,
          deleted: 0,
        },
        order_by: ['id', 'ASC'],
      },
    };

    this.apiService.post(getIdentifiers, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        const identifiers = response.result || [];

        if (this.mainItem.subItems[subItemIndex]) {
          this.mainItem.subItems[subItemIndex].identifiers = identifiers.map(
            (id: any) => ({
              id: id.id,
              name: id.name || '',
              value: id.value || '',
            })
          );

          this.items = [...this.items];
        }
      },
      error: (error) => {
        console.error('Error loading identifiers:', error);
      },
    });
  }

  private checkExistingSubItems(dccId: string): Promise<any[]> {
    const checkSubItems = {
      action: 'get',
      bd: this.database,
      table: 'dcc_subitem',
      opts: {
        where: {
          id_dcc: dccId,
          deleted: 0,
        },
        order_by: ['id', 'ASC'],
      },
    };

    return this.apiService
      .post(checkSubItems, UrlClass.URLNuevo)
      .toPromise()
      .then((response: any) => response?.result || []);
  }

  // ===== MÉTODOS AUXILIARES =====
  private generateId(): string {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===== TRACKBY FUNCTIONS =====
  trackByIndex(index: number, item: any): number {
    return index;
  }
}
