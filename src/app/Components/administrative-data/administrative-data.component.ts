import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NgMultiSelectDropDownModule,
  IDropdownSettings,
} from 'ng-multiselect-dropdown';
import { DccDataService } from '../../services/dcc-data.service';
import { ApiService } from '../../api/api.service';
import { UrlClass } from '../../shared/models/url.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-administrative-data',
  standalone: true,
  imports: [CommonModule, FormsModule, NgMultiSelectDropDownModule],
  templateUrl: './administrative-data.component.html',
  styleUrl: './administrative-data.component.css',
})
export class AdministrativeDataComponent implements OnInit, OnDestroy {
  editingBlocks: { [key: string]: boolean } = {};
  private subscription: Subscription = new Subscription();

  // Configuration for which blocks are editable
  editableBlocks = {
    software: false, // Software block is not editable
    core: true,
    identifications: true,
    laboratory: true,
    responsible: true,
    customer: true,
  };

  // Data properties
  softwareData: any = {};
  coreData: any = {};
  identifications: any[] = [];
  laboratoryData: any = {};
  responsiblePersons: any[] = [];
  customerData: any = {};

  // User data for dropdown
  listauser: any[] = [];
  selectedUsers: any[] = [];

  // Dropdown settings
  dropdownuser: IDropdownSettings = {
    idField: 'full_name',
    textField: 'full_name',
    allowSearchFilter: true,
    searchPlaceholderText: 'Buscar usuario',
    enableCheckAll: false,
    singleSelection: true,
    noDataAvailablePlaceholderText: 'Usuario no Disponible',
    noFilteredDataAvailablePlaceholderText: 'No Existe el Usuario',
  };

  constructor(
    private dccDataService: DccDataService,
    private backend: ApiService
  ) {}

  ngOnInit() {
    this.subscription.add(
      this.dccDataService.dccData$.subscribe((data) => {
        this.softwareData = { ...data.administrativeData.software };
        this.coreData = { ...data.administrativeData.core };
        this.identifications = [...data.administrativeData.identifications];
        this.laboratoryData = { ...data.administrativeData.laboratory };
        this.responsiblePersons = [
          ...data.administrativeData.responsiblePersons,
        ];
        this.customerData = { ...data.administrativeData.customer };
      })
    );

    this.loadUsers();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  loadUsers() {
    const info_usuarios = {
      action: 'get',
      bd: 'administracion',
      table: 'user',
      opts: {
        customSelect:
          'user.no_nomina, user.first_name, user.last_name, user.alias, CONCAT(user.first_name, " ", user.last_name) AS full_name',
        where: {
          deleted: 0,
          organizacion: 0,
          notequal: { id_crm: '' },
        },
        order_by: ['user.first_name', 'ASC'],
      },
    };

    this.backend
      .post(info_usuarios, UrlClass.URLNuevo)
      .subscribe((response: any) => {
        this.listauser = response['result'] || [];
        console.log('Users loaded:', this.listauser);
      });
  }

  toggleEdit(blockName: string) {
    // Only toggle if the block is editable
    if (this.editableBlocks[blockName as keyof typeof this.editableBlocks]) {
      this.editingBlocks[blockName] = !this.editingBlocks[blockName];
    }
  }

  isEditing(blockName: string): boolean {
    return this.editingBlocks[blockName] || false;
  }

  isBlockEditable(blockName: string): boolean {
    return this.editableBlocks[blockName as keyof typeof this.editableBlocks];
  }

  saveBlock(blockType: string) {
    if (blockType === 'software') {
      this.dccDataService.updateAdministrativeData(
        'software',
        this.softwareData
      );
    } else if (blockType === 'core') {
      this.dccDataService.updateAdministrativeData('core', this.coreData);
      // The service will automatically update PT-dependent methods
    } else if (blockType === 'identifications') {
      this.dccDataService.updateAdministrativeData(
        'identifications',
        this.identifications
      );
    } else if (blockType === 'laboratory') {
      this.dccDataService.updateAdministrativeData(
        'laboratory',
        this.laboratoryData
      );
    } else if (blockType === 'responsible') {
      this.dccDataService.updateAdministrativeData(
        'responsiblePersons',
        this.responsiblePersons
      );
    } else if (blockType === 'customer') {
      this.dccDataService.updateAdministrativeData(
        'customer',
        this.customerData
      );
    }
    delete this.editingBlocks[blockType];
  }

  // Method to handle date changes and update is_range_date
  onDateChange() {
    this.updateIsRangeDate();
  }

  private updateIsRangeDate() {
    if (this.coreData.performance_date && this.coreData.end_performance_date) {
      const performanceDate = new Date(this.coreData.performance_date);
      const endPerformanceDate = new Date(this.coreData.end_performance_date);

      // Compare dates (ignore time component)
      const isSameDate =
        performanceDate.toDateString() === endPerformanceDate.toDateString();

      if (isSameDate) {
        this.coreData.is_range_date = false;
      } else {
        this.coreData.is_range_date = true;
      }
    }
  }

  // Method to sync end performance date when is_range_date changes
  onIsRangeDateChange() {
    if (!this.coreData.is_range_date && this.coreData.performance_date) {
      // If not a range date, set end performance date equal to performance date
      this.coreData.end_performance_date = this.coreData.performance_date;
    }
  }

  cancelEdit(blockName: string) {
    this.editingBlocks[blockName] = false;
    // Reload data from service to revert changes
    const currentData = this.dccDataService.getCurrentData();
    switch (blockName) {
      case 'software':
        this.softwareData = { ...currentData.administrativeData.software };
        break;
      case 'core':
        this.coreData = { ...currentData.administrativeData.core };
        break;
      case 'identifications':
        this.identifications = [
          ...currentData.administrativeData.identifications,
        ];
        break;
      case 'laboratory':
        this.laboratoryData = { ...currentData.administrativeData.laboratory };
        break;
      case 'responsible':
        this.responsiblePersons = [
          ...currentData.administrativeData.responsiblePersons,
        ];
        break;
      case 'customer':
        this.customerData = { ...currentData.administrativeData.customer };
        break;
    }
  }

  addIdentification() {
    this.identifications.push({ issuer: '', value: '', name: '' });
  }

  removeIdentification(index: number) {
    this.identifications.splice(index, 1);
  }

  addResponsiblePerson() {
    this.responsiblePersons.push({
      role: '',
      name: [], // Initialize as array for multiselect
      email: '',
      phone: '',
    });
  }

  removeResponsiblePerson(index: number) {
    this.responsiblePersons.splice(index, 1);
  }

  onUserSelect(selectedItem: any, personIndex: number) {
    // When user is selected, update the name field with full_name
    if (selectedItem && selectedItem.full_name) {
      // Store the full name as string, but keep array format for multiselect
      const actualName = selectedItem.full_name;
      this.responsiblePersons[personIndex].name = actualName;
      console.log('Selected user name:', actualName);
    }
  }

  // Method to get the display name for a responsible person
  getResponsiblePersonDisplayName(person: any): string {
    // Handle both array format (from multiselect) and string format (from XML)
    if (Array.isArray(person.name) && person.name.length > 0) {
      return (
        person.name[0].full_name || person.name[0] || 'Usuario seleccionado'
      );
    } else if (typeof person.name === 'string' && person.name) {
      return person.name;
    }
    return 'No asignado';
  }
}
