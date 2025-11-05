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
  objectIdentifications: any[] = [];
  editingStates: { [key: string]: boolean } = {};
  private subscription = new Subscription();
  private database: string = 'calibraciones';

  // Variables para el control de edición del main item
  isEditingMainItem: boolean = false;

  // Variables para el modal de identificadores
  showIdentifierModal: boolean = false;
  currentSubItemIndex: number = -1;
  availableIdentifiers: any[] = [];
  selectedIdentifierName: string = '';

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
        this.items = data.items || [];
        this.objectIdentifications = data.objectIdentifications || [];
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
    if (blockName === 'object-identifications') {
      this.saveObjectIdentifications();
    } else if (blockName === 'subitems') {
      this.saveSubItems();
    } else {
      this.dccDataService.updateObjectIdentifications(
        this.objectIdentifications
      );
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

  // ===== OBJECT IDENTIFICATIONS - GESTIÓN =====
  addObjectGroup() {
    const newGroup = {
      id: this.generateId(),
      groupId: `group_${this.objectIdentifications.length + 1}`,
      groupName: `Grupo ${this.objectIdentifications.length + 1}`,
      groupIndex: this.objectIdentifications.length,
      assignedMeasurementRange: {
        label: 'Rated voltage',
        value: '',
        unit: '\\volt',
      },
      assignedScaleFactor: {
        label: 'Scale factor',
        value: '',
        unit: '\\one',
      },
      ratedFrequency: {
        label: 'Rated Frequency',
        value: '',
        unit: '\\one',
      },
    };
    this.objectIdentifications.push(newGroup);
  }

  removeObjectGroup(index: number) {
    if (this.objectIdentifications.length > 1) {
      this.objectIdentifications.splice(index, 1);
      this.objectIdentifications.forEach((group, i) => {
        group.groupIndex = i;
        group.groupId = `group_${i + 1}`;
        group.groupName = `Grupo ${i + 1}`;
      });
    }
  }

  saveObjectIdentifications() {
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

    Swal.fire({
      title: 'Guardando...',
      text: 'Actualizando configuración de grupos',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    this.checkExistingObjectGroups(dccId)
      .then((existingGroups) => {
        if (existingGroups.length > 0) {
          this.updateObjectGroups(dccId, existingGroups);
        } else {
          this.createObjectGroups(dccId);
        }
      })
      .catch((error) => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al verificar grupos existentes.',
        });
      });
  }

  private checkExistingObjectGroups(dccId: string): Promise<any[]> {
    const checkGroups = {
      action: 'get',
      bd: this.database,
      table: 'dcc_item_config',
      opts: {
        where: { id_dcc: dccId },
        order_by: ['id_item', 'ASC'],
      },
    };

    return this.apiService
      .post(checkGroups, UrlClass.URLNuevo)
      .toPromise()
      .then((response: any) => response?.result || []);
  }

  private createObjectGroups(dccId: string) {
    const createPromises = this.objectIdentifications.map((group, index) => {
      const createGroup = {
        action: 'create',
        bd: this.database,
        table: 'dcc_item_config',
        opts: {
          attributes: {
            id_item: index + 1,
            id_dcc: dccId,
            name: group.groupName,
            range_voltage: group.assignedMeasurementRange?.value || '',
            scale_factor: group.assignedScaleFactor?.value || '',
            rated_frequency: group.ratedFrequency?.value || '',
          },
        },
      };
      return this.apiService.post(createGroup, UrlClass.URLNuevo).toPromise();
    });

    Promise.all(createPromises)
      .then((responses) => {
        Swal.close();
        const allSuccess = responses.every((response: any) => response?.result);
        if (allSuccess) {
          this.dccDataService.updateObjectIdentifications(
            this.objectIdentifications
          );
          this.editingStates['object-identifications'] = false;
          Swal.fire({
            icon: 'success',
            title: '¡Guardado!',
            text: 'Los grupos se han creado correctamente.',
            timer: 2000,
            showConfirmButton: false,
            position: 'top-end',
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al crear algunos grupos.',
          });
        }
      })
      .catch((error) => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al crear los grupos.',
        });
      });
  }

  private updateObjectGroups(dccId: string, existingGroups: any[]) {
    const updatePromises: Promise<any>[] = [];

    this.objectIdentifications.forEach((group, index) => {
      const existingGroup = existingGroups.find((g) => g.id_item === index + 1);

      if (existingGroup) {
        const updateGroup = {
          action: 'update',
          bd: this.database,
          table: 'dcc_item_config',
          opts: {
            attributes: {
              name: group.groupName,
              range_voltage: group.assignedMeasurementRange?.value || '',
              scale_factor: group.assignedScaleFactor?.value || '',
              rated_frequency: group.ratedFrequency?.value || '',
            },
            where: { id: existingGroup.id },
          },
        };
        updatePromises.push(
          this.apiService.post(updateGroup, UrlClass.URLNuevo).toPromise()
        );
      } else {
        const createGroup = {
          action: 'create',
          bd: this.database,
          table: 'dcc_item_config',
          opts: {
            attributes: {
              id_item: index + 1,
              id_dcc: dccId,
              name: group.groupName,
              range_voltage: group.assignedMeasurementRange?.value || '',
              scale_factor: group.assignedScaleFactor?.value || '',
              rated_frequency: group.ratedFrequency?.value || '',
            },
          },
        };
        updatePromises.push(
          this.apiService.post(createGroup, UrlClass.URLNuevo).toPromise()
        );
      }
    });

    const groupsToDelete = existingGroups.filter(
      (existing) =>
        !this.objectIdentifications.some(
          (_, index) => index + 1 === existing.id_item
        )
    );

    groupsToDelete.forEach((groupToDelete) => {
      const deleteGroup = {
        action: 'update',
        bd: this.database,
        table: 'dcc_item_config',
        opts: {
          attributes: { deleted: 1 },
          where: { id: groupToDelete.id },
        },
      };
      updatePromises.push(
        this.apiService.post(deleteGroup, UrlClass.URLNuevo).toPromise()
      );
    });

    Promise.all(updatePromises)
      .then((responses) => {
        Swal.close();
        const allSuccess = responses.every((response: any) => response?.result);
        if (allSuccess) {
          this.dccDataService.updateObjectIdentifications(
            this.objectIdentifications
          );
          this.editingStates['object-identifications'] = false;
          Swal.fire({
            icon: 'success',
            title: '¡Guardado!',
            text: 'Los grupos se han actualizado correctamente.',
            timer: 2000,
            showConfirmButton: false,
            position: 'top-end',
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al actualizar algunos grupos.',
          });
        }
      })
      .catch((error) => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al actualizar los grupos.',
        });
      });
  }

  // ===== SUB ITEMS - GESTIÓN =====
  addSubItem() {
    const newSubItem = {
      id: this.generateId(),
      name: '',
      model: '',
      manufacturer: '',
      identifications: [],
      itemQuantities: [],
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
      this.mainItem.subItems.splice(index, 1);
    }
  }

  // Método mejorado para guardar subitems
  saveSubItems() {
    console.log('🔍 ===== SAVE SUBITEMS START =====');
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

    console.log('📊 Subitems to save:', this.mainItem.subItems);

    // Swal.fire({
    //   title: 'Guardando...',
    //   text: 'Actualizando subitems',
    //   allowOutsideClick: false,
    //   didOpen: () => {
    //     Swal.showLoading();
    //   },
    // });

    this.checkExistingSubItems(dccId)
      .then((existingSubItems) => {
        console.log('📊 Existing subitems from DB:', existingSubItems);

        if (existingSubItems.length > 0) {
          this.updateSubItems(dccId, existingSubItems);
        } else {
          this.createSubItems(dccId);
        }
      })
      .catch((error) => {
        Swal.close();
        console.error('❌ Error checking existing subitems:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al verificar subitems existentes.',
        });
      });
  }

  private checkExistingSubItems(dccId: string): Promise<any[]> {
    const checkSubItems = {
      action: 'get',
      bd: this.database,
      table: 'dcc_subitem',
      opts: {
        where: { id_dcc: dccId },
        order_by: ['id', 'ASC'],
      },
    };

    return this.apiService
      .post(checkSubItems, UrlClass.URLNuevo)
      .toPromise()
      .then((response: any) => response?.result || [])
      .catch((error) => {
        console.error('Error in checkExistingSubItems:', error);
        throw error;
      });
  }

  private createSubItems(dccId: string) {
    const createPromises = this.mainItem.subItems.map(
      (subItem: any, index: number) => {
        const attributes: any = {
          id_dcc: dccId,
          id_item: index + 1, // Agregar id_item secuencial
          description: subItem.name || '',
          manufacturer: subItem.manufacturer || '',
          model: subItem.model || '',
        };

        const optionalFields = [
          'serial_number',
          'costumer_asset',
          'rated_voltage',
          'length',
        ];

        if (subItem.identifications && Array.isArray(subItem.identifications)) {
          subItem.identifications.forEach((id: any) => {
            if (id.dbField && id.value && id.value.trim() !== '') {
              attributes[id.dbField] = id.value;
            }
          });
        }

        if (subItem.itemQuantities && Array.isArray(subItem.itemQuantities)) {
          subItem.itemQuantities.forEach((qty: any) => {
            if (qty.dbField && qty.value && qty.value.trim() !== '') {
              attributes[qty.dbField] = qty.value;
            }
          });
        }

        optionalFields.forEach((field) => {
          if (attributes[field] === undefined) {
            attributes[field] = '';
          }
        });

        console.log(`📝 Creating subitem ${index + 1}:`, attributes);

        const createSubItem = {
          action: 'create',
          bd: this.database,
          table: 'dcc_subitem',
          opts: { attributes },
        };

        return this.apiService
          .post(createSubItem, UrlClass.URLNuevo)
          .toPromise()
          .then((response: any) => response)
          .catch((error: any) => {
            console.error(`Error creating subitem ${index + 1}:`, error);
            throw error;
          });
      }
    );

    Promise.all(createPromises)
      .then((responses) => {
        Swal.close();
        const allSuccess = responses.every((response: any) => response?.result);

        if (allSuccess) {
          this.dccDataService.updateItems(this.items);
          this.editingStates['subitems'] = false;
          Swal.fire({
            icon: 'success',
            title: '¡Guardado!',
            text: 'Los subitems se han creado correctamente.',
            timer: 2000,
            showConfirmButton: false,
            position: 'top-end',
          });
          console.log('✅ Subitems created successfully');
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al crear algunos subitems.',
          });
        }
      })
      .catch((error) => {
        Swal.close();
        console.error('Error in createSubItems:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al crear los subitems.',
        });
      });
  }

  private updateSubItems(dccId: string, existingSubItems: any[]) {
    console.log('🔄 ===== UPDATE SUBITEMS START =====');

    const updatePromises: Promise<any>[] = [];

    this.mainItem.subItems.forEach((subItem: any, index: number) => {
      const existingSubItem = existingSubItems[index];

      console.log(`\n📋 Processing subitem ${index + 1}: ${subItem.name}`);

      // Log identifications directamente
      if (subItem.identifications && subItem.identifications.length > 0) {
        console.log('  🔍 Identifications:');
        subItem.identifications.forEach((id: any, idx: number) => {
          console.log(
            `    [${idx}] ${id.name} (dbField: ${id.dbField}): "${id.value}"`
          );

          // VALIDACIÓN: Si no tiene dbField, intentar asignarlo
          if (!id.dbField) {
            console.warn(
              `    ⚠️ Missing dbField for ${id.name}, attempting to assign...`
            );
            if (id.name === 'Serial Number') {
              id.dbField = 'serial_number';
            } else if (id.name === "Customer's asset ID") {
              id.dbField = 'costumer_asset';
            }
            console.log(`    ✅ Assigned dbField: ${id.dbField}`);
          }
        });
      }

      // Log quantities directamente
      if (subItem.itemQuantities && subItem.itemQuantities.length > 0) {
        console.log('  🔍 Item Quantities:');
        subItem.itemQuantities.forEach((qty: any, idx: number) => {
          console.log(
            `    [${idx}] ${qty.name} (dbField: ${qty.dbField}): "${qty.value}"`
          );

          // VALIDACIÓN: Si no tiene dbField, intentar asignarlo
          if (!qty.dbField) {
            console.warn(
              `    ⚠️ Missing dbField for ${qty.name}, attempting to assign...`
            );
            if (qty.name === 'Rated voltage') {
              qty.dbField = 'rated_voltage';
            } else if (qty.name === 'Length') {
              qty.dbField = 'length';
            }
            console.log(`    ✅ Assigned dbField: ${qty.dbField}`);
          }
        });
      }

      // Inicializar attributes
      const attributes: any = {
        description: subItem.name || '',
        manufacturer: subItem.manufacturer || '',
        model: subItem.model || '',
        serial_number: '',
        costumer_asset: '',
        rated_voltage: '',
        length: '',
      };

      console.log('  🛠️ Base attributes set:', attributes);

      // Procesar identificadores directamente del array original
      if (subItem.identifications && Array.isArray(subItem.identifications)) {
        subItem.identifications.forEach((id: any) => {
          if (id.dbField && id.value !== undefined && id.value !== null) {
            const finalValue = String(id.value).trim();
            attributes[id.dbField] = finalValue;
            console.log(`  ✅ SET ${id.dbField} = "${finalValue}"`);
          } else if (!id.dbField) {
            console.error(`  ❌ SKIPPED ${id.name}: Missing dbField!`);
          }
        });
      }

      // Procesar cantidades directamente del array original
      if (subItem.itemQuantities && Array.isArray(subItem.itemQuantities)) {
        subItem.itemQuantities.forEach((qty: any) => {
          if (qty.dbField && qty.value !== undefined && qty.value !== null) {
            const finalValue = String(qty.value).trim();
            attributes[qty.dbField] = finalValue;
            console.log(`  ✅ SET ${qty.dbField} = "${finalValue}"`);
          } else if (!qty.dbField) {
            console.error(`  ❌ SKIPPED ${qty.name}: Missing dbField!`);
          }
        });
      }

      console.log('  📤 Final attributes:', attributes);

      if (existingSubItem) {
        const updateSubItem = {
          action: 'update',
          bd: this.database,
          table: 'dcc_subitem',
          opts: {
            attributes,
            where: {
              id: existingSubItem.id,
            },
          },
        };

        console.log(
          `  🔄 UPDATE query:`,
          JSON.stringify(updateSubItem, null, 2)
        );

        updatePromises.push(
          this.apiService
            .post(updateSubItem, UrlClass.URLNuevo)
            .toPromise()
            .then((response: any) => {
              console.log(`  ✅ Update response:`, response);
              return response;
            })
            .catch((error: any) => {
              console.error(`  ❌ Update error:`, error);
              throw error;
            })
        );
      } else {
        const createSubItem = {
          action: 'create',
          bd: this.database,
          table: 'dcc_subitem',
          opts: {
            attributes: {
              ...attributes,
              id_dcc: dccId,
              id_item: index + 1, // Agregar id_item secuencial
            },
          },
        };

        console.log(
          `  ➕ CREATE query:`,
          JSON.stringify(createSubItem, null, 2)
        );

        updatePromises.push(
          this.apiService
            .post(createSubItem, UrlClass.URLNuevo)
            .toPromise()
            .then((response: any) => {
              console.log(`  ✅ Create response:`, response);
              return response;
            })
            .catch((error: any) => {
              console.error(`  ❌ Create error:`, error);
              throw error;
            })
        );
      }
    });

    const subItemsToDelete = existingSubItems.slice(
      this.mainItem.subItems.length
    );

    if (subItemsToDelete.length > 0) {
      console.log('🗑️ Subitems to delete:', subItemsToDelete.length);
      subItemsToDelete.forEach((subItemToDelete) => {
        const deleteSubItem = {
          action: 'update',
          bd: this.database,
          table: 'dcc_subitem',
          opts: {
            where: { id: subItemToDelete.id },
            attributes: { deleted: 1 },
          },
        };

        updatePromises.push(
          this.apiService.post(deleteSubItem, UrlClass.URLNuevo).toPromise()
        );
      });
    }

    Promise.all(updatePromises)
      .then((responses) => {
        Swal.close();
        console.log('📊 All responses:', responses);
        const allSuccess = responses.every((response: any) => response?.result);

        if (allSuccess) {
          this.dccDataService.updateItems(this.items);
          this.editingStates['subitems'] = false;
          this.loadDccData();

          Swal.fire({
            icon: 'success',
            title: '¡Guardado!',
            text: 'Los subitems se han actualizado correctamente.',
            timer: 2000,
            showConfirmButton: false,
            position: 'top-end',
          });
          console.log('✅ ===== UPDATE SUBITEMS SUCCESS =====\n');
        } else {
          console.log(
            '❌ Some updates failed:',
            responses.filter((r: any) => !r?.result)
          );
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al actualizar algunos subitems.',
          });
        }
      })
      .catch((error) => {
        Swal.close();
        console.error('❌ Error in updateSubItems:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al actualizar los subitems.',
        });
      });
  }

  removeIdentifierFromSubItem(
    subItemIndex: number,
    identifierName: string,
    type: string
  ) {
    const subItem = this.mainItem.subItems[subItemIndex];
    if (!subItem) return;

    if (type === 'identification') {
      const removedIdentifier = subItem.identifications?.find(
        (id: any) => id.name === identifierName
      );

      subItem.identifications =
        subItem.identifications?.filter(
          (id: any) => id.name !== identifierName
        ) || [];

      if (removedIdentifier && removedIdentifier.dbField) {
        if (!subItem._fieldsToClean) {
          subItem._fieldsToClean = [];
        }
        subItem._fieldsToClean.push(removedIdentifier.dbField);
      }
    } else if (type === 'itemQuantity') {
      const removedQuantity = subItem.itemQuantities?.find(
        (qty: any) => qty.name === identifierName
      );

      subItem.itemQuantities =
        subItem.itemQuantities?.filter(
          (qty: any) => qty.name !== identifierName
        ) || [];

      if (removedQuantity && removedQuantity.dbField) {
        if (!subItem._fieldsToClean) {
          subItem._fieldsToClean = [];
        }
        subItem._fieldsToClean.push(removedQuantity.dbField);
      }
    }

    this.items = [...this.items];
  }

  // ===== MODAL DE IDENTIFICADORES =====
  addPredefinedIdentifier(subItemIndex: number) {
    const subItem = this.mainItem.subItems[subItemIndex];
    if (!subItem) return;

    const allIdentifiers = [
      {
        name: 'Serial Number',
        issuer: 'Manufacturer',
        saveAs: 'identification',
        dbField: 'serial_number',
        icon: 'tag',
        description: 'Número de serie del fabricante',
      },
      {
        name: "Customer's asset ID",
        issuer: 'Customer',
        saveAs: 'identification',
        dbField: 'costumer_asset',
        icon: 'business',
        description: 'ID de activo del cliente',
      },
      {
        name: 'Rated voltage',
        issuer: 'Manufacturer',
        saveAs: 'itemQuantity',
        dbField: 'rated_voltage',
        unit: '\\volt',
        icon: 'flash_on',
        description: 'Voltaje nominal',
      },
      {
        name: 'Length',
        issuer: 'Manufacturer',
        saveAs: 'itemQuantity',
        dbField: 'length',
        unit: '\\meter',
        icon: 'straighten',
        description: 'Longitud del elemento',
      },
    ];

    const existingNames: string[] = [];
    if (subItem.identifications && Array.isArray(subItem.identifications)) {
      subItem.identifications.forEach((id: any) => {
        if (id && id.name) existingNames.push(id.name);
      });
    }
    if (subItem.itemQuantities && Array.isArray(subItem.itemQuantities)) {
      subItem.itemQuantities.forEach((qty: any) => {
        if (qty && qty.name) existingNames.push(qty.name);
      });
    }

    this.availableIdentifiers = allIdentifiers.filter(
      (identifier) => !existingNames.includes(identifier.name)
    );

    if (this.availableIdentifiers.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin opciones disponibles',
        text: 'Todos los identificadores predeterminados ya han sido agregados a este subitem.',
        timer: 3000,
        showConfirmButton: false,
        position: 'top-end',
      });
      return;
    }

    this.currentSubItemIndex = subItemIndex;
    this.selectedIdentifierName = '';
    this.showIdentifierModal = true;
  }

  closeIdentifierModal() {
    this.showIdentifierModal = false;
    this.currentSubItemIndex = -1;
    this.availableIdentifiers = [];
    this.selectedIdentifierName = '';
  }

  selectIdentifierOption(identifierName: string) {
    this.selectedIdentifierName = identifierName;
  }

  confirmAddIdentifier() {
    if (!this.selectedIdentifierName || this.currentSubItemIndex === -1) return;

    const selectedIdentifier = this.availableIdentifiers.find(
      (identifier) => identifier.name === this.selectedIdentifierName
    );

    if (!selectedIdentifier) return;

    try {
      this.addIdentifierToSubItem(this.currentSubItemIndex, selectedIdentifier);
      this.closeIdentifierModal();
    } catch (error) {
      console.error('Error adding identifier:', error);
      this.closeIdentifierModal();
    }
  }

  private addIdentifierToSubItem(subItemIndex: number, identifier: any) {
    const subItem = this.mainItem.subItems[subItemIndex];
    if (!subItem) return;

    try {
      if (identifier.saveAs === 'identification') {
        if (!subItem.identifications) subItem.identifications = [];
        const newIdentification = {
          issuer: identifier.issuer,
          name: identifier.name,
          value: '',
          selectedOption: {
            issuer: identifier.issuer,
            name: identifier.name,
            saveAs: 'identification',
          },
          dbField: identifier.dbField,
        };
        subItem.identifications.push(newIdentification);
      } else if (identifier.saveAs === 'itemQuantity') {
        if (!subItem.itemQuantities) subItem.itemQuantities = [];
        const newQuantity = {
          refType: this.generateRefTypeFromName(identifier.name),
          name: identifier.name,
          value: '',
          unit: identifier.unit,
          selectedOption: {
            issuer: identifier.issuer,
            name: identifier.name,
            saveAs: 'itemQuantity',
            unit: identifier.unit,
          },
          originalIssuer: identifier.issuer,
          saveAs: 'itemQuantity',
          dbField: identifier.dbField,
        };
        subItem.itemQuantities.push(newQuantity);
      }

      this.items = [...this.items];
    } catch (error) {
      console.error('Error in addIdentifierToSubItem:', error);
      throw error;
    }
  }

  // ===== MÉTODOS DE VALIDACIÓN =====
  getValidSubItemIdentifications(item: any): any[] {
    if (!item.subItems) return [];
    return item.subItems.reduce((validIds: any[], subItem: any) => {
      if (subItem.identifications) {
        const valid = subItem.identifications.filter(
          (id: any) =>
            id.value &&
            id.value.trim() !== '' &&
            id.name &&
            id.name.trim() !== ''
        );
        return validIds.concat(valid);
      }
      return validIds;
    }, []);
  }

  getValidSubItemQuantities(item: any): any[] {
    if (!item.subItems) return [];
    return item.subItems.reduce((validQtys: any[], subItem: any) => {
      if (subItem.itemQuantities) {
        const valid = subItem.itemQuantities.filter(
          (qty: any) =>
            qty.value &&
            qty.value.trim() !== '' &&
            qty.name &&
            qty.name.trim() !== ''
        );
        return validQtys.concat(valid);
      }
      return validQtys;
    }, []);
  }

  hasValidIdentifications(item: any): boolean {
    return this.getValidSubItemIdentifications(item).length > 0;
  }

  hasValidItemQuantities(item: any): boolean {
    return this.getValidSubItemQuantities(item).length > 0;
  }

  getValidIdentifications(item: any): any[] {
    return this.getValidSubItemIdentifications(item);
  }

  getValidItemQuantities(item: any): any[] {
    return this.getValidSubItemQuantities(item);
  }

  // ===== MÉTODOS AUXILIARES =====
  private generateId(): string {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRefTypeFromName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }

  // ===== TRACKBY FUNCTIONS PARA PERFORMANCE =====
  trackByIndex(index: number, item: any): number {
    return index;
  }

  trackByIdentifierName(index: number, identifier: any): any {
    return identifier.name || index;
  }

  // ELIMINAR trackByIdentifierKey - Ya no es necesario

  // Nuevo método para cargar identificadores desde la BD
  private loadSubItemIdentifiersFromDB() {
    console.log('🔍 ===== LOADING IDENTIFIERS FROM DB =====');

    const currentData = this.dccDataService.getCurrentData();
    const dccId = currentData.administrativeData.core.certificate_number;

    if (
      !dccId ||
      !this.mainItem.subItems ||
      this.mainItem.subItems.length === 0
    ) {
      console.log('❌ No DCC ID or no subitems to load');
      return;
    }

    this.checkExistingSubItems(dccId)
      .then((existingSubItems) => {
        console.log('📊 Existing subitems from DB:', existingSubItems);

        existingSubItems.forEach((existingSubItem, index) => {
          if (this.mainItem.subItems[index]) {
            const subItem = this.mainItem.subItems[index];

            console.log(`\n📋 Loading identifiers for subitem ${index + 1}:`);
            console.log('  DB data:', existingSubItem);

            if (!subItem.identifications) {
              subItem.identifications = [];
            }
            if (!subItem.itemQuantities) {
              subItem.itemQuantities = [];
            }

            const identifierMappings = [
              {
                dbField: 'serial_number',
                name: 'Serial Number',
                issuer: 'Manufacturer',
                saveAs: 'identification',
                icon: 'tag',
              },
              {
                dbField: 'costumer_asset',
                name: "Customer's asset ID",
                issuer: 'Customer',
                saveAs: 'identification',
                icon: 'business',
              },
            ];

            const quantityMappings = [
              {
                dbField: 'rated_voltage',
                name: 'Rated voltage',
                issuer: 'Manufacturer',
                saveAs: 'itemQuantity',
                unit: '\\volt',
                icon: 'flash_on',
              },
              {
                dbField: 'length',
                name: 'Length',
                issuer: 'Manufacturer',
                saveAs: 'itemQuantity',
                unit: '\\meter',
                icon: 'straighten',
              },
            ];

            // Cargar identifications
            identifierMappings.forEach((mapping) => {
              const dbValue = existingSubItem[mapping.dbField];

              if (dbValue && dbValue.trim() !== '') {
                const exists = subItem.identifications.some(
                  (id: any) => id.name === mapping.name
                );

                if (!exists) {
                  subItem.identifications.push({
                    issuer: mapping.issuer,
                    name: mapping.name,
                    value: dbValue,
                    selectedOption: {
                      issuer: mapping.issuer,
                      name: mapping.name,
                      saveAs: mapping.saveAs,
                    },
                    dbField: mapping.dbField,
                  });
                  console.log(`  ✅ Loaded ${mapping.name} = "${dbValue}"`);
                } else {
                  const existingId = subItem.identifications.find(
                    (id: any) => id.name === mapping.name
                  );
                  if (existingId) {
                    existingId.value = dbValue;
                    console.log(`  🔄 Updated ${mapping.name} = "${dbValue}"`);
                  }
                }
              }
            });

            // Cargar itemQuantities
            quantityMappings.forEach((mapping) => {
              const dbValue = existingSubItem[mapping.dbField];

              if (dbValue && dbValue.trim() !== '') {
                const exists = subItem.itemQuantities.some(
                  (qty: any) => qty.name === mapping.name
                );

                if (!exists) {
                  subItem.itemQuantities.push({
                    refType: this.generateRefTypeFromName(mapping.name),
                    name: mapping.name,
                    value: dbValue,
                    unit: mapping.unit,
                    selectedOption: {
                      issuer: mapping.issuer,
                      name: mapping.name,
                      saveAs: mapping.saveAs,
                      unit: mapping.unit,
                    },
                    originalIssuer: mapping.issuer,
                    saveAs: mapping.saveAs,
                    dbField: mapping.dbField,
                  });
                  console.log(`  ✅ Loaded ${mapping.name} = "${dbValue}"`);
                } else {
                  const existingQty = subItem.itemQuantities.find(
                    (qty: any) => qty.name === mapping.name
                  );
                  if (existingQty) {
                    existingQty.value = dbValue;
                    console.log(`  🔄 Updated ${mapping.name} = "${dbValue}"`);
                  }
                }
              }
            });
          }
        });

        this.items = [...this.items];
        console.log('✅ ===== IDENTIFIERS LOADED SUCCESSFULLY =====\n');
      })
      .catch((error) => {
        console.error('❌ Error loading subitem identifiers:', error);
      });
  }
}
