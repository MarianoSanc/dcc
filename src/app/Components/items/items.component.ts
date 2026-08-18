import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DccDataService } from '../../services/dcc-data.service';
import { ApiService } from '../../api/api.service';
import { UrlClass } from '../../shared/models/url.model';
import { Subscription, of } from 'rxjs';
import { switchMap, finalize, catchError, map } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-items',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './items.component.html',
  styleUrls: ['./items.component.css'],
})
export class ItemsComponent implements OnInit, OnDestroy {
  description: string = '';
  itemsList: any[] = [];
  editingStates: { [key: string]: boolean } = {};
  isEditingDescription: boolean = false;
  isEditingItems: boolean = false;
  isLoading: boolean = false;

  private subscription = new Subscription();
  private database: string = 'calibraciones';
  private loadedDccId: string = '';
  private dccItemId: number | null = null;

  constructor(
    private dccDataService: DccDataService,
    private apiService: ApiService,
  ) {}

  ngOnInit(): void {
    this.loadDccData();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private loadDccData(): void {
    this.subscription.add(
      this.dccDataService.dccData$.subscribe((data) => {
        const newDccId =
          data.administrativeData?.core?.certificate_number || '';
        if (this.loadedDccId !== newDccId) {
          this.loadedDccId = newDccId;
          this.loadDescriptionAndItemsFromDB(newDccId);
        }
      }),
    );
  }

  private loadDescriptionAndItemsFromDB(dccId: string): void {
    if (!dccId) {
      this.description = '';
      this.itemsList = [];
      this.dccItemId = null;
      return;
    }

    this.isLoading = true;

    const getItem = {
      action: 'get',
      bd: this.database,
      table: 'dcc_item',
      opts: {
        where: {
          id_dcc: dccId,
          deleted: 0,
        },
      },
    };

    this.apiService.post(getItem, UrlClass.URLNuevo)
      .pipe(
        switchMap((responseItem: any) => {
          if (responseItem.result && responseItem.result.length > 0) {
            const item = responseItem.result[0];
            const itemId = item.id;
            const description = item.description || '';

            const getItems = {
              action: 'get',
              bd: this.database,
              table: 'dcc_items',
              opts: {
                where: {
                  id_item: itemId,
                  id_dcc: dccId,
                  deleted: 0,
                },
                order_by: ['item_order', 'ASC'],
              },
            };

            return this.apiService.post(getItems, UrlClass.URLNuevo).pipe(
              switchMap((responseItems: any) => {
                if (responseItems?.result && responseItems.result.length > 0) {
                  return of({
                    itemId,
                    description,
                    items: responseItems.result,
                  });
                } else {
                  // Fallback alternative query
                  const getItemsAlternative = {
                    action: 'get',
                    bd: this.database,
                    table: 'dcc_items',
                    opts: {
                      where: {
                        id_dcc: dccId,
                        deleted: 0,
                      },
                      order_by: ['item_order', 'ASC'],
                    },
                  };
                  return this.apiService.post(getItemsAlternative, UrlClass.URLNuevo).pipe(
                    map((responseAlt: any) => ({
                      itemId,
                      description,
                      items: responseAlt?.result || [],
                    }))
                  );
                }
              }),
              catchError((err) => {
                console.error('Error loading items from items table:', err);
                return of({ itemId, description, items: [] });
              })
            );
          } else {
            return of({ itemId: null, description: '', items: [] });
          }
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (data: { itemId: number | null; description: string; items: any[] }) => {
          this.dccItemId = data.itemId;
          this.description = data.description;
          this.itemsList = data.items;
          if (this.itemsList.length > 0) {
            this.autoAssignOrderIfNeeded();
          }
          this.dccDataService.updateItemsList(this.itemsList, this.description);
        },
        error: (error) => {
          console.error('Error loading items/description from database:', error);
          this.dccItemId = null;
          this.description = '';
          this.itemsList = [];
          this.dccDataService.updateItemsList([], '');
        },
      });
  }

  isEditing(key: string): boolean {
    return this.editingStates[key] || false;
  }

  toggleEdit(key: string): void {
    this.editingStates[key] = !this.editingStates[key];
  }

  saveBlock(blockName: string): void {
    if (blockName === 'description') {
      this.saveDescription();
    } else if (blockName === 'items') {
      this.saveItems();
    }
  }

  cancelEdit(blockName: string): void {
    this.loadDccData();
    this.editingStates[blockName] = false;
  }

  toggleEditDescription(): void {
    this.isEditingDescription = !this.isEditingDescription;
    if (!this.isEditingDescription) {
      this.loadDccData();
    }
  }

  saveDescription(): void {
    const currentData = this.dccDataService.getCurrentData();
    const dccId = currentData.administrativeData.core.certificate_number;

    if (!dccId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se encontró el Certificate Number.',
      });
      return;
    }

    Swal.fire({
      title: 'Guardando...',
      text: 'Actualizando descripción',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    let saveOperation;

    if (this.dccItemId) {
      const updateItem = {
        action: 'update',
        bd: this.database,
        table: 'dcc_item',
        opts: {
          attributes: {
            description: this.description || '',
          },
          where: { id: this.dccItemId },
        },
      };
      saveOperation = this.apiService.post(updateItem, UrlClass.URLNuevo);
    } else {
      const createItem = {
        action: 'create',
        bd: this.database,
        table: 'dcc_item',
        opts: {
          attributes: {
            id_dcc: dccId,
            description: this.description || '',
            deleted: 0,
          },
        },
      };
      saveOperation = this.apiService.post(createItem, UrlClass.URLNuevo);
    }

    saveOperation.subscribe({
      next: (response: any) => {
        Swal.close();
        if (response.result) {
          if (!this.dccItemId) {
            this.dccItemId = response.result;
          }
          // ✅ Actualizar el servicio con la nueva descripción para que el PDF/Word use los datos actualizados
          this.dccDataService.updateItemsList(this.itemsList, this.description);
          this.isEditingDescription = false;
          Swal.fire({
            icon: 'success',
            title: '¡Guardado!',
            text: 'La descripción se ha actualizado correctamente.',
            timer: 2000,
            showConfirmButton: false,
            position: 'top-end',
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al guardar la descripción.',
          });
        }
      },
      error: (error) => {
        Swal.close();
        console.error('Error saving description:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error al guardar la descripción.',
        });
      },
    });
  }

  addItem(): void {
    const newItem = {
      id: null,
      object: '',
      manufacturer: '',
      model: '',
      serial_number: '',
      costumer_asset: '',
      comment: '',
      item_order: this.itemsList.length + 1,
    };
    this.itemsList.push(newItem);
  }

  moveItemUp(index: number): void {
    if (index > 0) {
      const temp = this.itemsList[index];
      this.itemsList[index] = this.itemsList[index - 1];
      this.itemsList[index - 1] = temp;
    }
  }

  moveItemDown(index: number): void {
    if (index < this.itemsList.length - 1) {
      const temp = this.itemsList[index];
      this.itemsList[index] = this.itemsList[index + 1];
      this.itemsList[index + 1] = temp;
    }
  }

  private autoAssignOrderIfNeeded(): void {
    // Verificar si todos los items tienen item_order = 0 o undefined
    const allZeroOrUndefined = this.itemsList.every(
      (item) => !item.item_order || item.item_order === 0,
    );

    if (allZeroOrUndefined && this.itemsList.length > 0) {
      this.itemsList.forEach((item, index) => {
        item.item_order = index + 1;
      });
    } else if (this.itemsList.length > 0) {
      // Si tienen orden asignado, ordenar por ese campo
      this.itemsList.sort((a, b) => (a.item_order || 0) - (b.item_order || 0));
    }
  }

  removeItem(index: number): void {
    if (index >= 0 && index < this.itemsList.length) {
      const item = this.itemsList[index];
      if (item.id) {
        item._markedForDeletion = true;
      } else {
        this.itemsList.splice(index, 1);
      }
    }
  }

  saveItems(): void {
    const currentData = this.dccDataService.getCurrentData();
    const dccId = currentData.administrativeData.core.certificate_number;

    if (!dccId || !this.dccItemId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se encontraron los datos necesarios para guardar.',
      });
      return;
    }

    if (this.itemsList.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin items',
        text: 'No hay items para guardar.',
      });
      return;
    }

    Swal.fire({
      title: 'Guardando...',
      text: 'Actualizando items',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    this.processItemsSave(dccId);
  }

  private async processItemsSave(dccId: string): Promise<void> {
    try {
      const promises: Promise<any>[] = [];

      for (let i = 0; i < this.itemsList.length; i++) {
        const item = this.itemsList[i];
        item.item_order = i + 1; // Asignar número de orden secuencial

        if (item._markedForDeletion && item.id) {
          promises.push(this.deleteItem(item.id));
          continue;
        }

        if (item.id) {
          promises.push(this.updateItem(item));
        } else {
          promises.push(this.createItem(dccId, item));
        }
      }

      await Promise.all(promises);

      this.itemsList = this.itemsList.filter((i: any) => !i._markedForDeletion);

      Swal.close();
      this.editingStates['items'] = false;
      this.dccDataService.updateItemsList(this.itemsList, this.description);

      Swal.fire({
        icon: 'success',
        title: '¡Guardado!',
        text: 'Los items se han actualizado correctamente.',
        timer: 2000,
        showConfirmButton: false,
        position: 'top-end',
      });
    } catch (error) {
      Swal.close();

      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al guardar los items.',
      });
    }
  }

  private createItem(dccId: string, item: any): Promise<any> {
    const createRequest = {
      action: 'create',
      bd: this.database,
      table: 'dcc_items',
      opts: {
        attributes: {
          id_item: this.dccItemId,
          id_dcc: dccId,
          object: item.object || '',
          manufacturer: item.manufacturer || '',
          model: item.model || '',
          serial_number: item.serial_number || '',
          costumer_asset: item.costumer_asset || '',
          comment: item.comment || '',
          item_order: item.item_order || 0,
          deleted: 0,
        },
      },
    };

    return this.apiService.post(createRequest, UrlClass.URLNuevo).toPromise();
  }

  private updateItem(item: any): Promise<any> {
    const updateRequest = {
      action: 'update',
      bd: this.database,
      table: 'dcc_items',
      opts: {
        attributes: {
          object: item.object || '',
          manufacturer: item.manufacturer || '',
          model: item.model || '',
          serial_number: item.serial_number || '',
          costumer_asset: item.costumer_asset || '',
          comment: item.comment || '',
          item_order: item.item_order || 0,
        },
        where: { id: item.id },
      },
    };

    return this.apiService.post(updateRequest, UrlClass.URLNuevo).toPromise();
  }

  private deleteItem(itemId: number): Promise<any> {
    const deleteRequest = {
      action: 'update',
      bd: this.database,
      table: 'dcc_items',
      opts: {
        attributes: { deleted: 1 },
        where: { id: itemId },
      },
    };

    return this.apiService.post(deleteRequest, UrlClass.URLNuevo).toPromise();
  }
}
