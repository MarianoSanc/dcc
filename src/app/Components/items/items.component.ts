import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DccDataService } from '../../services/dcc-data.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-items',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './items.component.html',
  styleUrl: './items.component.css',
})
export class ItemsComponent implements OnInit {
  // Estados de edición por bloque
  editingStates = {
    mainItem: false,
    objectGroups: false,
    subItems: false,
  };

  // Datos del item principal
  mainItem: any = {
    name: '',
    model: '',
    manufacturer: '',
    serialNumber: '',
    customerAssetId: '',
    identifications: [],
    itemQuantities: [],
    subItems: [],
  };

  // Grupos de object identifications
  objectGroups: any[] = [];

  // Opciones predefinidas para identificaciones de subitems - Actualizado
  identificationOptions = [
    {
      issuer: 'manufacturer',
      name: 'Serial Number',
      displayText: 'Serial Number (Manufacturer)',
      saveAs: 'identification',
    },
    {
      issuer: 'customer',
      name: "Customer's asset ID",
      displayText: "Customer's asset ID (Customer)",
      saveAs: 'identification',
    },
    {
      issuer: 'manufacturer',
      name: 'Rated voltage',
      displayText: 'Rated voltage (Manufacturer)',
      saveAs: 'itemQuantity',
      unit: '\\volt',
    },
    {
      issuer: 'manufacturer',
      name: 'Length',
      displayText: 'Length (Manufacturer)',
      saveAs: 'itemQuantity',
      unit: '\\meter',
    },
    {
      issuer: 'manufacturer',
      name: 'Characteristic impedance',
      displayText: 'Characteristic impedance (Manufacturer)',
      saveAs: 'itemQuantity',
      unit: '\\ohm',
    },
  ];

  constructor(private dccDataService: DccDataService) {}

  ngOnInit() {
    this.dccDataService.dccData$.subscribe((data) => {
      if (data.items && data.items.length > 0) {
        this.mainItem = { ...data.items[0] };
        // Asegurar que las propiedades nuevas existan
        if (!this.mainItem.serialNumber) this.mainItem.serialNumber = '';
        if (!this.mainItem.customerAssetId) this.mainItem.customerAssetId = '';
        if (!this.mainItem.subItems) this.mainItem.subItems = [];
        if (!this.mainItem.itemQuantities) this.mainItem.itemQuantities = [];

        // Asegurar estructura correcta de subitems
        this.ensureSubItemsStructure();
      }

      this.objectGroups = [...(data.objectIdentifications || [])];
      this.updateGroupNames();
    });
  }

  // Métodos de control de edición
  isEditing(block: string): boolean {
    return (this.editingStates as any)[block] || false;
  }

  toggleEdit(block: string): void {
    // Cancelar cualquier edición activa antes de empezar una nueva
    this.cancelAllEdits();
    (this.editingStates as any)[block] = true;
  }

  cancelEdit(block: string): void {
    (this.editingStates as any)[block] = false;
    // Recargar datos originales
    this.ngOnInit();
  }

  cancelAllEdits(): void {
    this.editingStates.mainItem = false;
    this.editingStates.objectGroups = false;
    this.editingStates.subItems = false;
  }

  saveBlock(block: string): void {
    switch (block) {
      case 'mainItem':
        this.saveMainItem();
        break;
      case 'objectGroups':
        this.saveObjectGroups();
        break;
      case 'subItems':
        this.saveSubItems();
        break;
    }
    (this.editingStates as any)[block] = false;
  }

  // Métodos para manejar grupos de object identifications
  addObjectGroup() {
    const newGroup = {
      id: this.generateId(),
      groupId: `group_${this.objectGroups.length + 1}`,
      groupName: `Grupo ${this.objectGroups.length + 1}`,
      groupIndex: this.objectGroups.length,
      assignedMeasurementRange: {
        label: 'Rated voltage', // Siempre fijo
        value: '',
        unit: '\\volt', // Siempre fijo
      },
      assignedScaleFactor: {
        label: 'Scale factor', // Siempre fijo
        value: '',
        unit: '\\one', // Siempre fijo
      },
      ratedFrequency: {
        label: 'Rated Frequency', // Siempre fijo
        value: '',
        unit: '\\one', // Siempre fijo
      },
    };

    this.objectGroups.push(newGroup);
    this.updateGroupNames();
  }

  // Método para asegurar que los labels y units estén siempre correctos
  private enforceFixedLabelsAndUnits(): void {
    this.objectGroups.forEach((group) => {
      // Asegurar labels y units fijos
      group.assignedMeasurementRange.label = 'Rated voltage';
      group.assignedMeasurementRange.unit = '\\volt';

      group.assignedScaleFactor.label = 'Scale factor';
      group.assignedScaleFactor.unit = '\\one';

      group.ratedFrequency.label = 'Rated Frequency';
      group.ratedFrequency.unit = '\\one';
    });
  }

  // Guardar métodos específicos
  saveMainItem(): void {
    this.dccDataService.updateItems([this.mainItem]);

    Swal.fire({
      icon: 'success',
      title: '¡Guardado!',
      text: 'Main Item guardado correctamente',
      timer: 2000,
      showConfirmButton: false,
      position: 'top-end',
    });
  }

  saveObjectGroups(): void {
    // Asegurar que los labels y units estén correctos antes de guardar
    this.enforceFixedLabelsAndUnits();

    this.dccDataService.updateObjectIdentifications(this.objectGroups);

    Swal.fire({
      icon: 'success',
      title: '¡Guardado!',
      text: 'Object Groups guardados correctamente',
      timer: 2000,
      showConfirmButton: false,
      position: 'top-end',
    });
  }

  saveSubItems(): void {
    this.dccDataService.updateItems([this.mainItem]);

    Swal.fire({
      icon: 'success',
      title: '¡Guardado!',
      text: 'Sub Items guardados correctamente',
      timer: 2000,
      showConfirmButton: false,
      position: 'top-end',
    });
  }

  // Método para actualizar nombres de grupos automáticamente
  updateGroupNames() {
    if (this.objectGroups.length === 2) {
      this.objectGroups[0].groupName = 'BEFORE ADJUSTMENT';
      this.objectGroups[1].groupName = 'AFTER ADJUSTMENT';
    } else {
      this.objectGroups.forEach((group, index) => {
        if (
          !group.groupName ||
          group.groupName.startsWith('Grupo ') ||
          group.groupName === 'BEFORE ADJUSTMENT' ||
          group.groupName === 'AFTER ADJUSTMENT'
        ) {
          group.groupName = `Grupo ${index + 1}`;
        }
      });
    }
  }

  // Métodos para manejar identificaciones del main item
  addMainItemIdentification() {
    this.mainItem.identifications.push({
      issuer: 'manufacturer',
      value: '',
      name: '',
    });
  }

  removeMainItemIdentification(index: number) {
    this.mainItem.identifications.splice(index, 1);
  }

  // Métodos para manejar subitems (sin cambios)
  addSubItem() {
    this.mainItem.subItems.push({
      id: this.generateId(),
      name: '',
      model: '',
      manufacturer: '',
      identifications: [],
      itemQuantities: [],
    });
  }

  removeSubItem(index: number) {
    this.mainItem.subItems.splice(index, 1);
  }

  // Métodos para manejar identificaciones de subitems
  addSubItemIdentification(subItemIndex: number) {
    // Agregar una identificación simple con la primera opción seleccionada por defecto
    if (!this.mainItem.subItems[subItemIndex].identifications) {
      this.mainItem.subItems[subItemIndex].identifications = [];
    }

    this.mainItem.subItems[subItemIndex].identifications.push({
      issuer: this.identificationOptions[0].issuer,
      name: this.identificationOptions[0].name,
      value: '',
      selectedOption: this.identificationOptions[0],
    });
  }

  removeSubItemIdentification(
    subItemIndex: number,
    identificationIndex: number
  ) {
    this.mainItem.subItems[subItemIndex].identifications.splice(
      identificationIndex,
      1
    );
  }

  // Nuevo método para remover itemQuantity
  removeSubItemQuantity(subItemIndex: number, quantityIndex: number) {
    this.mainItem.subItems[subItemIndex].itemQuantities.splice(
      quantityIndex,
      1
    );
  }

  // Método para actualizar issuer y name cuando se selecciona una opción
  onIdentificationOptionChange(
    subItemIndex: number,
    identificationIndex: number,
    selectedOption: any
  ) {
    const identification =
      this.mainItem.subItems[subItemIndex].identifications[identificationIndex];
    identification.issuer = selectedOption.issuer;
    identification.name = selectedOption.name;
    identification.selectedOption = selectedOption;

    // Si es itemQuantity, necesitamos mover el entry o crear uno en itemQuantities
    if (selectedOption.saveAs === 'itemQuantity') {
      this.convertToItemQuantity(
        subItemIndex,
        identificationIndex,
        selectedOption
      );
    }
  }

  // Nuevo método para convertir identification a itemQuantity
  private convertToItemQuantity(
    subItemIndex: number,
    identificationIndex: number,
    selectedOption: any
  ) {
    const subItem = this.mainItem.subItems[subItemIndex];
    const identification = subItem.identifications[identificationIndex];

    // Asegurar que itemQuantities existe
    if (!subItem.itemQuantities) {
      subItem.itemQuantities = [];
    }

    // Verificar si ya existe una itemQuantity con este name
    const existingQtyIndex = subItem.itemQuantities.findIndex(
      (qty: any) => qty.name === selectedOption.name
    );

    if (existingQtyIndex === -1) {
      // Crear nueva itemQuantity
      subItem.itemQuantities.push({
        refType: this.generateRefTypeFromName(selectedOption.name),
        name: selectedOption.name,
        value: identification.value,
        unit: selectedOption.unit || '',
        selectedOption: selectedOption,
        originalIssuer: selectedOption.issuer,
      });
    } else {
      // Actualizar existente
      subItem.itemQuantities[existingQtyIndex].value = identification.value;
      subItem.itemQuantities[existingQtyIndex].selectedOption = selectedOption;
    }

    // Remover de identifications
    subItem.identifications.splice(identificationIndex, 1);
  }

  // Método para obtener la opción seleccionada actual - Mejorado
  getSelectedIdentificationOption(identification: any) {
    // Si ya tiene selectedOption, usarla
    if (identification.selectedOption) {
      return identification.selectedOption;
    }

    // Si no tiene selectedOption, buscar por issuer y name
    const foundOption = this.identificationOptions.find(
      (option) =>
        option.issuer === identification.issuer &&
        option.name === identification.name
    );

    if (foundOption) {
      // Asignar la opción encontrada al objeto para futuras referencias
      identification.selectedOption = foundOption;
      return foundOption;
    }

    // Si no encuentra coincidencia exacta, devolver la primera opción como fallback
    return this.identificationOptions[0];
  }

  // Asegurar que todos los subitems tengan la estructura correcta - Mejorado
  private ensureSubItemsStructure() {
    if (this.mainItem.subItems) {
      this.mainItem.subItems.forEach((subItem: any) => {
        // Asegurar arrays existen
        if (!subItem.identifications) subItem.identifications = [];
        if (!subItem.itemQuantities) subItem.itemQuantities = [];

        // Asegurar que las identificaciones tienen selectedOption
        subItem.identifications.forEach((identification: any) => {
          if (!identification.selectedOption) {
            // Buscar la opción correcta basada en issuer y name
            const matchingOption = this.identificationOptions.find(
              (option) =>
                option.issuer === identification.issuer &&
                option.name === identification.name
            );

            if (matchingOption) {
              identification.selectedOption = matchingOption;
              console.log(
                `🔧 Assigned selectedOption for identification: ${identification.name} (${identification.issuer})`
              );
            } else {
              // Si no encuentra match exacto, asignar la primera opción
              identification.selectedOption = this.identificationOptions[0];
              console.log(
                `🔧 No exact match found for identification: ${identification.name} (${identification.issuer}), using default`
              );
            }
          }
        });

        // Para itemQuantities que vienen del XML, agregar selectedOption si corresponde
        subItem.itemQuantities.forEach((quantity: any) => {
          if (!quantity.selectedOption && !quantity.originalIssuer) {
            const matchingOption = this.identificationOptions.find(
              (option) =>
                option.name === quantity.name &&
                option.saveAs === 'itemQuantity'
            );
            if (matchingOption) {
              quantity.selectedOption = matchingOption;
              quantity.originalIssuer = matchingOption.issuer;
              console.log(
                `🔧 Assigned selectedOption for itemQuantity: ${quantity.name}`
              );
            }
          } else if (!quantity.selectedOption && quantity.originalIssuer) {
            // Si tiene originalIssuer pero no selectedOption, buscar por name e issuer
            const matchingOption = this.identificationOptions.find(
              (option) =>
                option.name === quantity.name &&
                option.issuer.toLowerCase() ===
                  quantity.originalIssuer.toLowerCase() &&
                option.saveAs === 'itemQuantity'
            );
            if (matchingOption) {
              quantity.selectedOption = matchingOption;
              console.log(
                `🔧 Assigned selectedOption for itemQuantity with originalIssuer: ${quantity.name} (${quantity.originalIssuer})`
              );
            }
          }
        });
      });
    }
  }

  // Simplificar validaciones para subitems
  getValidSubItemIdentifications(subItem: any): any[] {
    return (subItem.identifications || []).filter(
      (id: any) => id.value?.trim() && id.name?.trim()
    );
  }

  getValidSubItemQuantities(subItem: any): any[] {
    return (subItem.itemQuantities || []).filter(
      (qty: any) => qty.value?.trim() && qty.name?.trim()
    );
  }

  // Métodos para verificar si hay datos válidos en subitems
  hasValidIdentifications(item: any): boolean {
    return this.getValidSubItemIdentifications(item).length > 0;
  }

  hasValidItemQuantities(item: any): boolean {
    return this.getValidSubItemQuantities(item).length > 0;
  }

  // Actualizar los métodos de validación para usar los nuevos métodos
  getValidIdentifications(item: any): any[] {
    return this.getValidSubItemIdentifications(item);
  }

  getValidItemQuantities(item: any): any[] {
    return this.getValidSubItemQuantities(item);
  }

  // Método para obtener todos los entries para mostrar en el formulario
  getAllSubItemEntries(subItemIndex: number): any[] {
    const subItem = this.mainItem.subItems[subItemIndex];
    const allEntries: any[] = [];

    // Agregar identifications
    if (subItem.identifications) {
      subItem.identifications.forEach((entry: any) => {
        allEntries.push(entry);
      });
    }

    // Agregar itemQuantities que tienen selectedOption (son del formulario)
    if (subItem.itemQuantities) {
      subItem.itemQuantities.forEach((qty: any) => {
        if (qty.selectedOption) {
          allEntries.push({
            issuer: qty.originalIssuer || 'manufacturer',
            name: qty.name,
            value: qty.value,
            selectedOption: qty.selectedOption,
            saveAs: qty.saveAs || 'itemQuantity',
          });
        }
      });
    }

    return allEntries;
  }

  // Método actualizado para cuando se actualiza un valor
  onEntryValueChange(
    subItemIndex: number,
    entryIndex: number,
    newValue: string
  ) {
    const entries = this.getAllSubItemEntries(subItemIndex);
    const entry = entries[entryIndex];

    if (entry.saveAs === 'identification') {
      // Buscar en identifications y actualizar
      const idIndex = this.mainItem.subItems[
        subItemIndex
      ].identifications.findIndex(
        (id: any) => id.name === entry.name && id.issuer === entry.issuer
      );
      if (idIndex !== -1) {
        this.mainItem.subItems[subItemIndex].identifications[idIndex].value =
          newValue;
      }
    } else if (entry.saveAs === 'itemQuantity') {
      // Buscar en itemQuantities y actualizar
      const qtyIndex = this.mainItem.subItems[
        subItemIndex
      ].itemQuantities.findIndex(
        (qty: any) =>
          qty.selectedOption &&
          qty.selectedOption.name === entry.selectedOption.name
      );
      if (qtyIndex !== -1) {
        this.mainItem.subItems[subItemIndex].itemQuantities[qtyIndex].value =
          newValue;
      }
    }
  }

  // Método para generar refType basado en el nombre
  private generateRefTypeFromName(name: string): string {
    const refTypeMap: { [key: string]: string } = {
      'Rated voltage': 'hv_ratedVoltage',
      Length: 'basic_length',
      'Characteristic impedance': 'basic_impedance',
    };
    return refTypeMap[name] || 'basic_property';
  }

  // Nuevos métodos para verificar si un campo específico tiene valor
  hasValueInMeasurementRange(group: any, field: string): boolean {
    return (
      group.assignedMeasurementRange &&
      group.assignedMeasurementRange[field] &&
      group.assignedMeasurementRange[field].trim() !== ''
    );
  }

  hasValueInScaleFactor(group: any, field: string): boolean {
    return (
      group.assignedScaleFactor &&
      group.assignedScaleFactor[field] &&
      group.assignedScaleFactor[field].trim() !== ''
    );
  }

  hasValueInRatedFrequency(group: any, field: string): boolean {
    return (
      group.ratedFrequency &&
      group.ratedFrequency[field] &&
      group.ratedFrequency[field].trim() !== ''
    );
  }

  // Métodos para verificar si una sección completa tiene algún valor
  measurementRangeHasAnyValue(group: any): boolean {
    return (
      this.hasValueInMeasurementRange(group, 'label') ||
      this.hasValueInMeasurementRange(group, 'value') ||
      this.hasValueInMeasurementRange(group, 'unit')
    );
  }

  scaleFactorHasAnyValue(group: any): boolean {
    return (
      this.hasValueInScaleFactor(group, 'label') ||
      this.hasValueInScaleFactor(group, 'value') ||
      this.hasValueInScaleFactor(group, 'unit')
    );
  }

  ratedFrequencyHasAnyValue(group: any): boolean {
    return (
      this.hasValueInRatedFrequency(group, 'label') ||
      this.hasValueInRatedFrequency(group, 'value') ||
      this.hasValueInRatedFrequency(group, 'unit')
    );
  }

  // Métodos para validar subitems (actualizados)
  hasValidSubItems(): boolean {
    return this.getValidSubItems().length > 0;
  }

  getValidSubItems(): any[] {
    return (
      this.mainItem.subItems?.filter(
        (subItem: any) =>
          subItem.name?.trim() ||
          subItem.model?.trim() ||
          subItem.manufacturer?.trim() ||
          this.hasValidIdentifications(subItem) ||
          this.hasValidItemQuantities(subItem)
      ) || []
    );
  }

  // Métodos para manejar object groups
  removeObjectGroup(index: number) {
    if (this.objectGroups.length > 1) {
      this.objectGroups.splice(index, 1);
      // Reindexar grupos
      this.objectGroups.forEach((group, idx) => {
        group.groupIndex = idx;
        group.groupId = `group_${idx + 1}`;
      });
      this.updateGroupNames();
    }
  }

  // Métodos para validar grupos de object identifications
  hasValidObjectGroups(): boolean {
    return this.getValidObjectGroups().length > 0;
  }

  getValidObjectGroups(): any[] {
    return this.objectGroups.filter(
      (group) =>
        this.hasValidMeasurementRange(group) ||
        this.hasValidScaleFactor(group) ||
        this.hasValidRatedFrequency(group)
    );
  }

  hasValidMeasurementRange(group: any): boolean {
    return (
      group.assignedMeasurementRange &&
      (group.assignedMeasurementRange.value?.trim() ||
        group.assignedMeasurementRange.label?.trim() ||
        group.assignedMeasurementRange.unit?.trim())
    );
  }

  hasValidScaleFactor(group: any): boolean {
    return (
      group.assignedScaleFactor &&
      (group.assignedScaleFactor.value?.trim() ||
        group.assignedScaleFactor.label?.trim() ||
        group.assignedScaleFactor.unit?.trim())
    );
  }

  hasValidRatedFrequency(group: any): boolean {
    return (
      group.ratedFrequency &&
      (group.ratedFrequency.value?.trim() ||
        group.ratedFrequency.label?.trim() ||
        group.ratedFrequency.unit?.trim())
    );
  }

  // Helper method
  private generateId(): string {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
