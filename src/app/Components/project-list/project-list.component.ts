import { Component, OnInit, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../api/api.service';
import { UrlClass } from '../../shared/models/url.model';

export interface PtComparisonItem {
  pt: string;
  os: number;
  dcc: number;
  crm: number;
  total: number;
  proyectosOS: string[];
  proyectosDCC: string[];
  proyectosCRM: string[];
}

export interface ProyectoComparativoModal {
  nombre: string;
  countOS: number;
  countDCC: number;
  countCRM: number;
  hasDiscrepancy: boolean;
}

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.css'],
})
export class ProjectListComponent implements OnInit {
  months = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
  ];

  years: number[] = [];

  startMonth: number = 1;
  startYear: number = new Date().getFullYear();
  endMonth: number = new Date().getMonth() + 1;
  endYear: number = new Date().getFullYear();
  selectedType: string = 'Todos';
  selectedProjectType: string = 'Todos';
  selectedStages: string[] = [];
  isStageDropdownOpen: boolean = false;

  stageOptions: string[] = ['Adjudicado', 'Realizado', 'Finalizado'];

  projectTypeOptions: string[] = [
    'Todos',
    'Calibración',
    'GIS',
    'Cable AT',
    'Cable MT',
    'Otros',
  ];

  selectedAccredited: string = 'Todos';
  accreditedOptions: string[] = ['Todos', 'Si', 'No', 'Parcial'];

  filterProjectText: string = '';

  isTableCollapsed: boolean = false;
  sortField: 'fecha_adjudicado' | 'fecha_realizado' | '' = '';
  sortDirection: 'asc' | 'desc' = 'desc';

  phPtCounts: PtComparisonItem[] = [];
  pcPtCounts: PtComparisonItem[] = [];
  phTotalCount: number = 0;
  pcTotalCount: number = 0;
  mostrarModalPT: boolean = false;
  ptSeleccionado: PtComparisonItem | null = null;
  proyectosComparativosModal: ProyectoComparativoModal[] = [];

  private readonly phPtRegex = /(?:IE|TR)\s+(\d{2})/;
  private readonly pcPtRegex = /(?:CC|DCC)\s+(\d{2})\s+\d{2}/;

  meetings: any[] = [];
  filteredMeetings: any[] = [];
  loading: boolean = false;

  crmBaseUrl: string = UrlClass.isLocalNetwork
    ? 'http://192.168.1.200:81'
    : 'http://26.110.177.38:81';
  certificatesByProject: Record<string, string[]> = {};
  totalUniqueCertificates: number = 0;
  totalOsCount: number = 0;
  totalDccCount: number = 0;
  totalAttachmentsCount: number = 0;
  uniqueProjectCount: number = 0;

  constructor(
    private apiService: ApiService,
    private elementRef: ElementRef,
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (
      !this.elementRef.nativeElement
        .querySelector('.multiselect-container')
        ?.contains(event.target)
    ) {
      this.closeStageDropdown();
    }
  }

  ngOnInit(): void {
    this.initYears();
    this.loadMeetings();
  }

  private initYears(): void {
    const current = new Date().getFullYear();
    for (let y = current - 8; y <= current + 1; y++) {
      this.years.push(y);
    }
  }

  backToMenu(): void {
    const base = this.getBasePath();
    window.location.href = base ? `${base}/` : '/';
  }

  private getBasePath(): string {
    const path = window.location.pathname || '/';
    return path.startsWith('/DCC') ? '/DCC' : '';
  }

  onSearch(): void {
    this.applyFilter();
  }

  toggleStageDropdown(): void {
    this.isStageDropdownOpen = !this.isStageDropdownOpen;
  }

  closeStageDropdown(): void {
    this.isStageDropdownOpen = false;
  }

  isStageSelected(stage: string): boolean {
    return this.selectedStages.includes(stage);
  }

  toggleStage(stage: string): void {
    const index = this.selectedStages.indexOf(stage);
    if (index > -1) {
      this.selectedStages.splice(index, 1);
    } else {
      this.selectedStages.push(stage);
    }
    this.applyFilter();
  }

  selectAllStages(): void {
    this.selectedStages = [...this.stageOptions];
    this.applyFilter();
  }

  clearStages(): void {
    this.selectedStages = [];
    this.applyFilter();
  }

  getStageButtonText(): string {
    if (!this.selectedStages || this.selectedStages.length === 0) {
      return 'Todas las etapas';
    }
    if (this.selectedStages.length === this.stageOptions.length) {
      return 'Todas seleccionadas';
    }
    return this.selectedStages.join(', ');
  }

  private loadMeetings(): void {
    this.loading = true;

    // 1. opportunity_calpro: stage IN ('Awarded', 'Performed', 'Finalized')
    const getCalpro = {
      action: 'get',
      bd: 'hvtest2',
      table: 'opportunity_calpro',
      opts: {
        attributes: ['id', 'name', 'stage', 'created_at'],
        where: {
          deleted: 0,
          stage: ['Awarded', 'Performed', 'Finalized'],
        },
      },
    };

    // 2. opportunity: stage IN ('Closed Won', 'Accomplished', 'Finalized')
    const getOpportunity = {
      action: 'get',
      bd: 'hvtest2',
      table: 'opportunity',
      opts: {
        attributes: ['id', 'name', 'dut', 'stage', 'created_at'],
        where: {
          deleted: 0,
          stage: ['Closed Won', 'Accomplished', 'Finalized'],
        },
      },
    };

    // 3. Certificados dcc_data
    const getCertificates = {
      action: 'get',
      bd: 'calibraciones',
      table: 'dcc_data',
      opts: {
        attributes: ['id', 'accredited'],
        where: { deleted: 0 },
      },
    };

    forkJoin([
      this.apiService.post(getCalpro, UrlClass.URLNuevo),
      this.apiService.post(getOpportunity, UrlClass.URLNuevo),
      this.apiService.post(getCertificates, UrlClass.URLNuevo),
    ]).subscribe({
      next: async ([calproResp, oppResp, certResp]: any) => {
        const rawCalpro: any[] = Array.isArray(calproResp?.result)
          ? calproResp.result
          : [];
        const rawOpp: any[] = Array.isArray(oppResp?.result)
          ? oppResp.result
          : [];
        const rawCerts: any[] = Array.isArray(certResp?.result)
          ? certResp.result
          : [];

        this.certificatesByProject = this.buildCertificatesByProject(rawCerts);
        const dccDataByProject = this.buildDccDataByProject(rawCerts);

        // Mapear proyectos de opportunity_calpro (Calibración)
        const calproProjects = rawCalpro.map((p: any) => ({
          id: p.id,
          name: p.name || p.id,
          projectKey: this.extractProjectKey(p),
          rawStage: p.stage,
          projectStage: this.unifyStage(p.stage),
          projectType: 'Calibración',
          tableSource: 'opportunity_calpro',
          created_at: p.created_at,
        }));

        // Mapear proyectos de opportunity (Ensayos / Servicios)
        const oppProjects = rawOpp.map((p: any) => ({
          id: p.id,
          name: p.name || p.id,
          projectKey: this.extractProjectKey(p),
          rawStage: p.stage,
          projectStage: this.unifyStage(p.stage),
          projectType: p.dut || 'Otros',
          tableSource: 'opportunity',
          created_at: p.created_at,
        }));

        const combinedProjects = [...calproProjects, ...oppProjects];

        // 4. Traer notas, conteo OS y adjuntos CRM para todos los proyectos
        const allProjectIds = combinedProjects.map((p) => p.id);
        const [notesMap, osDutMap, attachmentsMap] = await Promise.all([
          this.loadNotesForProjects(allProjectIds),
          this.loadOsDutCountForProjects(allProjectIds),
          this.loadAttachmentsForProjects(combinedProjects),
        ]);

        // Asignar notas, certificados, conteo OS, adjuntos, acreditación y fechas calculadas a cada proyecto
        this.meetings = combinedProjects.map((project) => {
          const notes = notesMap[project.id] || [];
          const certificates =
            this.certificatesByProject[project.projectKey] || [];
          const { fecha_adjudicado, fecha_realizado } =
            this.extractStageDates(notes);
          const osInfo = osDutMap[project.id] || {
            count: 0,
            pts: [],
            yesCount: 0,
            noCount: 0,
            rawPts: [],
          };
          const projectAttachments = attachmentsMap[project.id] || [];

          const isCalpro = this.isCalproProject(project);
          let accredited_status: 'Si' | 'No' | 'Parcial' = 'No';
          let accredited_detail: string = '';

          if (isCalpro) {
            const certs = dccDataByProject[project.projectKey] || [];
            const total = certs.length;
            const yes = certs.filter((c) => c.accredited === 1).length;
            const no = total - yes;

            if (total === 0) {
              accredited_status = 'No';
              accredited_detail = '';
            } else if (yes === total) {
              accredited_status = 'Si';
              accredited_detail = '';
            } else if (yes === 0) {
              accredited_status = 'No';
              accredited_detail = '';
            } else {
              accredited_status = 'Parcial';
              accredited_detail = `${yes} Sí, ${no} No`;
            }
          } else {
            // PH: evaluado respecto a los DUTs en OS
            const total = osInfo.count;
            const yes = osInfo.yesCount || 0;
            const no = osInfo.noCount || 0;

            if (total === 0) {
              accredited_status = 'No';
              accredited_detail = '';
            } else if (no === 0 && yes > 0) {
              accredited_status = 'Si';
              accredited_detail = '';
            } else if (yes === 0) {
              accredited_status = 'No';
              accredited_detail = '';
            } else {
              accredited_status = 'Parcial';
              accredited_detail = `${yes} Sí, ${no} No`;
            }
          }

          const dccCerts = dccDataByProject[project.projectKey] || [];
          const dcc_has_unaccredited =
            dccCerts.length > 0 && dccCerts.some((c) => c.accredited === 0);
          const dcc_certificates = dccCerts.map((c) => ({
            id: c.id,
            accredited: c.accredited === 1,
          }));

          return {
            ...project,
            notes,
            certificates,
            certificateCount: certificates.length,
            dcc_certificates,
            dcc_has_unaccredited,
            os_dut_count: osInfo.count,
            os_pts: osInfo.pts,
            os_raw_pts: osInfo.rawPts || [],
            attachments: projectAttachments,
            attachmentCount: projectAttachments.length,
            accredited_status,
            accredited_detail,
            fecha_adjudicado,
            fecha_realizado,
            date_start_date: project.created_at || '',
          };
        });

        // Imprimir en consola cada proyecto con todas sus notas
        console.log(
          '📊 [Histórico] Proyectos cargados con sus notas, OS y adjuntos:',
          this.meetings,
        );
        this.meetings.forEach((project: any) => {
          console.log(
            `📋 Proyecto: ${project.name} (ID: ${project.id}) | Etapa: ${project.projectStage} | OS DUTs: ${project.os_dut_count} | Adjuntos (${project.attachmentCount}):`,
            project.attachments,
          );
        });

        this.applyFilter();
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Error al cargar proyectos del histórico:', err);
        this.meetings = [];
        this.filteredMeetings = [];
        this.loading = false;
      },
    });
  }

  /**
   * Trae en bloques de 100 todas las notas de hvtest2.note para los IDs de proyectos
   */
  private async loadNotesForProjects(
    projectIds: string[],
  ): Promise<Record<string, any[]>> {
    const notesByProject: Record<string, any[]> = {};
    if (!projectIds || projectIds.length === 0) {
      return notesByProject;
    }

    const chunkSize = 100;
    const chunks: string[][] = [];
    for (let i = 0; i < projectIds.length; i += chunkSize) {
      chunks.push(projectIds.slice(i, i + chunkSize));
    }

    const requests = chunks.map((chunk) => {
      const getNotes = {
        action: 'get',
        bd: 'hvtest2',
        table: 'note',
        opts: {
          attributes: ['parent_id', 'parent_type', 'created_at', 'data'],
          where: {
            deleted: 0,
            parent_id: chunk,
          },
          order_by: ['created_at', 'DESC'],
        },
      };

      return this.apiService.post(getNotes, UrlClass.URLNuevo).toPromise();
    });

    try {
      const results = await Promise.all(requests);
      results.forEach((res: any) => {
        const rows: any[] = Array.isArray(res?.result) ? res.result : [];
        rows.forEach((note: any) => {
          const parentId = note.parent_id;
          if (!notesByProject[parentId]) {
            notesByProject[parentId] = [];
          }
          notesByProject[parentId].push(note);
        });
      });
    } catch (error) {
      console.error('Error cargando notas de proyectos:', error);
    }

    return notesByProject;
  }

  /**
   * Carga desde la BD 'orden' los servicios y dut_service de cada proyecto,
   * y calcula la cantidad de DUTs en la etapa/fase más reciente (más alta).
   */
  private async loadOsDutCountForProjects(
    projectIds: string[],
  ): Promise<
    Record<
      string,
      { count: number; pts: string[]; yesCount: number; noCount: number; rawPts: string[] }
    >
  > {
    const dutInfoByProject: Record<
      string,
      { count: number; pts: string[]; yesCount: number; noCount: number; rawPts: string[] }
    > = {};
    if (!projectIds || projectIds.length === 0) {
      return dutInfoByProject;
    }

    const chunkSize = 100;
    const chunks: string[][] = [];
    for (let i = 0; i < projectIds.length; i += chunkSize) {
      chunks.push(projectIds.slice(i, i + chunkSize));
    }

    // 1. Obtener todos los servicios asociados a los proyectos
    const serviceRequests = chunks.map((chunk) => {
      const getServices = {
        action: 'get',
        bd: 'orden',
        table: 'service',
        opts: {
          attributes: ['id', 'id_project'],
          where: {
            deleted: 0,
            id_project: chunk,
          },
        },
      };
      return this.apiService.post(getServices, UrlClass.URLNuevo).toPromise();
    });

    try {
      const serviceResults = await Promise.all(serviceRequests);
      const serviceIdToProjectId: Record<string, string> = {};
      const allServiceIds: string[] = [];

      serviceResults.forEach((res: any) => {
        const services: any[] = Array.isArray(res?.result) ? res.result : [];
        services.forEach((s: any) => {
          if (s.id && s.id_project) {
            serviceIdToProjectId[s.id] = s.id_project;
            allServiceIds.push(s.id);
          }
        });
      });

      if (allServiceIds.length === 0) {
        return dutInfoByProject;
      }

      // 2. Obtener los dut_service asociados a los servicios
      const dutChunks: string[][] = [];
      for (let i = 0; i < allServiceIds.length; i += chunkSize) {
        dutChunks.push(allServiceIds.slice(i, i + chunkSize));
      }

      const dutRequests = dutChunks.map((chunk) => {
        const getDutServices = {
          action: 'get',
          bd: 'orden',
          table: 'dut_service',
          opts: {
            attributes: ['id', 'id_service', 'fase', 'pt'],
            where: {
              deleted: 0,
              id_service: chunk,
            },
          },
        };
        return this.apiService
          .post(getDutServices, UrlClass.URLNuevo)
          .toPromise();
      });

      const dutResults = await Promise.all(dutRequests);
      // Agrupar dut_service por project_id
      const dutsByProject: Record<string, any[]> = {};

      dutResults.forEach((res: any) => {
        const dutServices: any[] = Array.isArray(res?.result) ? res.result : [];
        dutServices.forEach((d: any) => {
          const projectId = serviceIdToProjectId[d.id_service];
          if (projectId) {
            if (!dutsByProject[projectId]) {
              dutsByProject[projectId] = [];
            }
            dutsByProject[projectId].push(d);
          }
        });
      });

      // 3. Para cada proyecto, calcular los DUTs y el tooltip en la etapa/fase más reciente (mayor fase)
      projectIds.forEach((pId) => {
        const projectDuts = dutsByProject[pId] || [];
        if (projectDuts.length === 0) {
          dutInfoByProject[pId] = {
            count: 0,
            pts: [],
            yesCount: 0,
            noCount: 0,
            rawPts: [],
          };
          return;
        }

        // Obtener todas las fases numéricas (null/vacío => 0)
        const phases = projectDuts.map((d: any) => {
          const val = Number(d?.fase);
          return Number.isFinite(val) ? val : 0;
        });

        // La fase más reciente es la de mayor número
        const latestPhase = Math.max(...phases);

        // Filtrar los DUTs que pertenecen a esa etapa/fase
        const dutsInLatestPhase = projectDuts.filter((d: any) => {
          const val = Number(d?.fase);
          const normalized = Number.isFinite(val) ? val : 0;
          return normalized === latestPhase;
        });

        // Sumar considerando múltiples PTs por DUT (si no tiene PT, suma 1)
        const count = this.getDutsTotalCount(dutsInLatestPhase);
        const rawPts = this.getPtsList(dutsInLatestPhase);
        const isPtValid = (p: any): boolean => {
          const text = (p || '').toString().trim();
          const match =
            text.match(/^PT[\s\-_]*0*([1-9]\d?)$/i) || text.match(/^0*([1-9]\d?)$/);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            return num >= 1 && num <= 99;
          }
          return false;
        };
        const yesCount = rawPts.filter((p) => isPtValid(p)).length;
        const noCount = rawPts.length - yesCount;
        const pts = this.groupPtsForTooltip(rawPts);

        dutInfoByProject[pId] = { count, pts, yesCount, noCount, rawPts };
      });
    } catch (error) {
      console.error('Error cargando DUTs de OS para proyectos:', error);
    }

    return dutInfoByProject;
  }

  /**
   * Obtiene la clave principal de adjuntos (parent_id) correspondiente al proyecto:
   * PC -> Sufijo 'ECC' (ej. PC0562ECC)
   * PH -> Sufijo 'EI' (ej. PH2796EI)
   */
  getAttachmentParentId(project: any): string {
    const key = (project.projectKey || project.id || '')
      .toString()
      .trim()
      .toUpperCase();
    const isCalpro = this.isCalproProject(project);
    return isCalpro ? `${key}ECC` : `${key}EI`;
  }

  /**
   * Obtiene las posibles claves de adjuntos para el proyecto.
   * Para PC se usa el sufijo 'ECC' y para PH el sufijo 'EI'.
   */
  getAttachmentParentIds(project: any): string[] {
    const key = (project.projectKey || project.id || '')
      .toString()
      .trim()
      .toUpperCase();
    if (!key) return [];
    const isCalpro = this.isCalproProject(project);
    if (isCalpro) {
      return [`${key}ECC`];
    }
    return [`${key}EI`];
  }

  /**
   * Carga los adjuntos de hvtest2.attachment filtrados por:
   * parent_type = 'Task', field = 'attachments', type = 'application/pdf'
   * agrupados por el ID de cada proyecto.
   */
  private async loadAttachmentsForProjects(
    projects: any[],
  ): Promise<Record<string, string[]>> {
    const attachmentsByProject: Record<string, string[]> = {};
    if (!projects || projects.length === 0) {
      return attachmentsByProject;
    }

    const parentIdToProjectId: Record<string, string> = {};
    const targetParentIds: string[] = [];

    projects.forEach((p) => {
      attachmentsByProject[p.id] = [];
      const parentIds = this.getAttachmentParentIds(p);
      parentIds.forEach((parentId) => {
        if (parentId) {
          parentIdToProjectId[parentId] = p.id;
          targetParentIds.push(parentId);
        }
      });
    });

    const chunkSize = 100;
    const chunks: string[][] = [];
    for (let i = 0; i < targetParentIds.length; i += chunkSize) {
      chunks.push(targetParentIds.slice(i, i + chunkSize));
    }

    const requests = chunks.map((chunk) => {
      const getAttachments = {
        action: 'get',
        bd: 'hvtest2',
        table: 'attachment',
        opts: {
          attributes: [
            'id',
            'name',
            'parent_id',
            'parent_type',
            'field',
            'type',
          ],
          where: {
            deleted: 0,
            parent_type: 'Task',
            field: 'attachments',
            type: 'application/pdf',
            parent_id: chunk,
          },
        },
      };

      return this.apiService
        .post(getAttachments, UrlClass.URLNuevo)
        .toPromise();
    });

    try {
      const results = await Promise.all(requests);
      results.forEach((res: any) => {
        const rows: any[] = Array.isArray(res?.result) ? res.result : [];
        rows.forEach((att: any) => {
          const projectId = parentIdToProjectId[att.parent_id];
          if (projectId && attachmentsByProject[projectId]) {
            const fileName = att.name || att.id;
            attachmentsByProject[projectId].push(fileName);
          }
        });
      });
    } catch (error) {
      console.error('Error cargando adjuntos para proyectos:', error);
    }

    return attachmentsByProject;
  }

  /**
   * Calcula el total de DUTs considerando que cada PT cuenta como una unidad.
   * Si un DUT tiene múltiples PTs (arreglo o string separado por comas), se suman individualmente.
   * Si un DUT no tiene PT (vacío, null o undefined), suma 1 al total.
   */
  getDutsTotalCount(duts: any[]): number {
    if (!duts || !Array.isArray(duts)) {
      return 0;
    }

    return duts.reduce((total: number, dut: any) => {
      const ptValue = dut?.pt ?? dut?.PT;

      if (Array.isArray(ptValue)) {
        const validItems = ptValue.filter((pt) => String(pt).trim() !== '');
        return total + (validItems.length > 0 ? validItems.length : 1);
      }

      if (typeof ptValue === 'string') {
        const trimmed = ptValue.trim();
        if (!trimmed) return total + 1;

        // Soporte si viene serializado como JSON (ej. "[\"24\",\"46\"]")
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            const validItems = parsed.filter((pt) => String(pt).trim() !== '');
            return total + (validItems.length > 0 ? validItems.length : 1);
          }
        } catch (_) {}

        const count = trimmed
          .split(',')
          .map((pt) => pt.trim())
          .filter((pt) => pt !== '').length;

        return total + (count > 0 ? count : 1);
      }

      if (typeof ptValue === 'number') {
        return total + 1;
      }

      return total + 1; // Suma 1 si es null, undefined o vacío
    }, 0);
  }

  /**
   * Extrae la lista de PTs como arreglo para el tooltip con diseño idéntico a DCC/DIE.
   * Si un DUT no tiene PT, se agrega como "NA".
   */
  getPtsList(duts: any[]): string[] {
    if (!duts || !Array.isArray(duts) || duts.length === 0) {
      return ['NA'];
    }

    const allPts: string[] = [];

    duts.forEach((dut: any) => {
      const ptValue = dut?.pt ?? dut?.PT;

      if (Array.isArray(ptValue)) {
        const valid = ptValue
          .map((p) => String(p).trim())
          .filter((p) => p !== '');
        if (valid.length > 0) {
          allPts.push(...valid);
        } else {
          allPts.push('NA');
        }
        return;
      }

      if (typeof ptValue === 'string') {
        const trimmed = ptValue.trim();
        if (!trimmed) {
          allPts.push('NA');
          return;
        }

        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            const valid = parsed
              .map((p) => String(p).trim())
              .filter((p) => p !== '');
            if (valid.length > 0) {
              allPts.push(...valid);
            } else {
              allPts.push('NA');
            }
            return;
          }
        } catch (_) {}

        const split = trimmed
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p !== '');

        if (split.length > 0) {
          allPts.push(...split);
        } else {
          allPts.push('NA');
        }
        return;
      }

      if (typeof ptValue === 'number') {
        allPts.push(String(ptValue));
        return;
      }

      allPts.push('NA');
    });

    return allPts;
  }

  /**
   * Agrupa y formatea los PTs para el tooltip de la columna OS.
   * Por ejemplo: ['42', '45', '42', '14'] -> ['PT-14', 'PT-42 x 2', 'PT-45']
   */
  groupPtsForTooltip(pts: string[]): string[] {
    if (!pts || !Array.isArray(pts) || pts.length === 0) {
      return [];
    }

    // Contar ocurrencias
    const counts = new Map<string, number>();
    for (const rawPt of pts) {
      const item = String(rawPt || '').trim();
      if (!item) continue;
      counts.set(item, (counts.get(item) || 0) + 1);
    }

    // Formatear la etiqueta de cada PT (solo PT-01 a PT-99 son válidos; PT-OTRO u otros son NA)
    const formatPtLabel = (pt: string): string => {
      const text = (pt || '').toString().trim();
      const match =
        text.match(/^PT[\s\-_]*0*([1-9]\d?)$/i) || text.match(/^0*([1-9]\d?)$/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num >= 1 && num <= 99) {
          return `PT-${String(num).padStart(2, '0')}`;
        }
      }
      return 'NA';
    };

    // Agrupar por la etiqueta formateada
    const groupedCounts = new Map<string, number>();
    for (const [key, count] of counts.entries()) {
      const label = formatPtLabel(key);
      groupedCounts.set(label, (groupedCounts.get(label) || 0) + count);
    }

    // Ordenar: números de PT primero ordenados naturalmente, y 'NA' al final
    const sortedKeys = Array.from(groupedCounts.keys()).sort((a, b) => {
      if (a === 'NA') return 1;
      if (b === 'NA') return -1;
      return a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });

    return sortedKeys.map((key) => {
      const count = groupedCounts.get(key) || 1;
      return count > 1 ? `${key} x ${count}` : key;
    });
  }

  /**
   * Extrae la fecha de adjudicado y realizado buscando en las notas.
   * - Adjudicado: stage Closed Won o Awarded
   * - Realizado: stage Accomplished o Performed
   * En caso de múltiples notas con el mismo stage, toma la más reciente de acuerdo a created_at.
   */
  private extractStageDates(notes: any[]): {
    fecha_adjudicado: string | null;
    fecha_realizado: string | null;
  } {
    let fecha_adjudicado: string | null = null;
    let fecha_realizado: string | null = null;
    let maxAdjudicadoTime = -1;
    let maxRealizadoTime = -1;

    if (!notes || notes.length === 0) {
      return { fecha_adjudicado, fecha_realizado };
    }

    for (const note of notes) {
      if (!note || !note.data) continue;

      let parsedData: any = null;
      if (typeof note.data === 'object') {
        parsedData = note.data;
      } else if (typeof note.data === 'string') {
        try {
          parsedData = JSON.parse(note.data);
        } catch {
          // Si no es JSON válido directamente, continuar
        }
      }

      const noteStage = parsedData?.field === 'stage' ? parsedData.value : null;
      if (!noteStage) continue;

      const noteTime = note.created_at
        ? new Date(note.created_at).getTime()
        : 0;
      const normalizedStage = (noteStage || '').toString().trim().toLowerCase();

      // Adjudicado: "Closed Won" o "Awarded"
      if (normalizedStage === 'closed won' || normalizedStage === 'awarded') {
        if (noteTime > maxAdjudicadoTime) {
          maxAdjudicadoTime = noteTime;
          fecha_adjudicado = note.created_at;
        }
      }

      // Realizado: "Accomplished" o "Performed"
      if (
        normalizedStage === 'accomplished' ||
        normalizedStage === 'performed'
      ) {
        if (noteTime > maxRealizadoTime) {
          maxRealizadoTime = noteTime;
          fecha_realizado = note.created_at;
        }
      }
    }

    return { fecha_adjudicado, fecha_realizado };
  }

  /**
   * Unifica las etapas según la regla solicitada:
   * - Adjudicado: Awarded y Closed Won
   * - Realizado: Performed y Accomplished
   * - Finalizado: Finalized
   */
  private unifyStage(stage: string): string {
    const normalized = (stage || '').toString().trim().toLowerCase();
    if (normalized === 'awarded' || normalized === 'closed won') {
      return 'Adjudicado';
    }
    if (normalized === 'performed' || normalized === 'accomplished') {
      return 'Realizado';
    }
    if (normalized === 'finalized') {
      return 'Finalizado';
    }
    return stage;
  }

  private extractProjectKey(project: any): string {
    const fromId = (project?.id || '')
      .toString()
      .trim()
      .toUpperCase()
      .match(/^([A-Z]{2}\d{3,5})/);
    if (fromId) return fromId[1];
    const fromName = (project?.name || '')
      .toString()
      .trim()
      .toUpperCase()
      .match(/^([A-Z]{2}\d{3,5})/);
    if (fromName) return fromName[1];
    return project?.id || '';
  }

  private extractProjectKeyFromDccId(id: string): string {
    const text = (id || '').toString().trim().toUpperCase();
    const match = text.match(/^([A-Z]{2}\d{3,5})/);
    return match ? match[1] : '';
  }

  private buildCertificatesByProject(
    certificates: any[],
  ): Record<string, string[]> {
    return certificates.reduce(
      (map: Record<string, string[]>, cert: any) => {
        const projectKey = this.extractProjectKeyFromDccId(cert.id);
        if (!projectKey) return map;
        if (!map[projectKey]) {
          map[projectKey] = [];
        }
        map[projectKey].push(cert.id);
        return map;
      },
      {} as Record<string, string[]>,
    );
  }

  private buildDccDataByProject(
    certificates: any[],
  ): Record<string, { id: string; accredited: number }[]> {
    return certificates.reduce(
      (
        map: Record<string, { id: string; accredited: number }[]>,
        cert: any,
      ) => {
        const projectKey = this.extractProjectKeyFromDccId(cert.id);
        if (!projectKey) return map;
        if (!map[projectKey]) {
          map[projectKey] = [];
        }
        const isAccredited =
          cert.accredited === 1 ||
          cert.accredited === '1' ||
          cert.accredited === true
            ? 1
            : 0;
        map[projectKey].push({ id: cert.id, accredited: isAccredited });
        return map;
      },
      {} as Record<string, { id: string; accredited: number }[]>,
    );
  }

  isCalproProject(project: any): boolean {
    const key = (project?.projectKey || project?.id || '')
      .toString()
      .trim()
      .toUpperCase();
    return (
      project?.tableSource === 'opportunity_calpro' || key.startsWith('PC')
    );
  }

  private applyFilter(): void {
    const start = new Date(this.startYear, this.startMonth - 1, 1);
    const end = new Date(this.endYear, this.endMonth, 0); // last day of end month

    this.filteredMeetings = this.meetings
      .map((m: any) => ({
        ...m,
        _start: m.date_start_date ? new Date(m.date_start_date) : null,
      }))
      .filter((m: any) => {
        if (!m._start) return false;
        const inRange = m._start >= start && m._start <= end;
        if (!inRange) return false;

        if (this.selectedType && this.selectedType !== 'Todos') {
          const namePrefix = (m.projectKey || '')
            .toString()
            .trim()
            .slice(0, 2)
            .toUpperCase();
          if (namePrefix !== this.selectedType) {
            return false;
          }
        }

        if (this.selectedProjectType && this.selectedProjectType !== 'Todos') {
          if ((m.projectType || '') !== this.selectedProjectType) {
            return false;
          }
        }

        if (this.selectedStages && this.selectedStages.length > 0) {
          if (!this.selectedStages.includes(m.projectStage)) {
            return false;
          }
        }

        if (this.selectedAccredited && this.selectedAccredited !== 'Todos') {
          if (m.accredited_status !== this.selectedAccredited) {
            return false;
          }
        }

        if (this.filterProjectText) {
          const search = this.filterProjectText.toString().trim().toLowerCase();
          const name = (m.name || '').toString().toLowerCase();
          const key = (m.projectKey || '').toString().toLowerCase();
          if (!name.includes(search) && !key.includes(search)) {
            return false;
          }
        }

        return true;
      })
      .sort((a: any, b: any) => this.compareMeetings(a, b));

    // Deduplicar totales por projectKey
    const uniqueProjectKeys = new Set<string>();
    let totalDcc = 0;
    let totalOs = 0;
    let totalAttachments = 0;

    for (const meeting of this.filteredMeetings) {
      const projectKey = meeting.projectKey;
      if (!uniqueProjectKeys.has(projectKey)) {
        uniqueProjectKeys.add(projectKey);
        totalDcc += meeting.certificateCount || 0;
        totalOs += meeting.os_dut_count || 0;
        totalAttachments += meeting.attachmentCount || 0;
      }
    }
    this.uniqueProjectCount = uniqueProjectKeys.size;
    this.totalDccCount = totalDcc;
    this.totalOsCount = totalOs;
    this.totalAttachmentsCount = totalAttachments;
    this.totalUniqueCertificates = totalDcc;
    this.calculateAttachmentPtCounts();
  }

  sortBy(field: 'fecha_adjudicado' | 'fecha_realizado'): void {
    if (this.sortField === field) {
      if (this.sortDirection === 'desc') {
        this.sortDirection = 'asc';
      } else {
        // Al tercer clic, restablecer orden por defecto
        this.sortField = '';
        this.sortDirection = 'desc';
      }
    } else {
      this.sortField = field;
      this.sortDirection = 'desc';
    }
    this.applyFilter();
  }

  getSortIcon(field: string): string {
    if (this.sortField !== field) {
      return '⇅';
    }
    return this.sortDirection === 'desc' ? '▼' : '▲';
  }

  private compareMeetings(a: any, b: any): number {
    if (
      this.sortField === 'fecha_adjudicado' ||
      this.sortField === 'fecha_realizado'
    ) {
      const timeA = a[this.sortField]
        ? new Date(a[this.sortField]).getTime()
        : null;
      const timeB = b[this.sortField]
        ? new Date(b[this.sortField]).getTime()
        : null;

      if (timeA !== null && timeB !== null) {
        return this.sortDirection === 'desc' ? timeB - timeA : timeA - timeB;
      }
      if (timeA === null && timeB !== null) return 1;
      if (timeA !== null && timeB === null) return -1;
    }

    // Orden por defecto: _start (fecha de inicio/creación) descendente
    const startA = a._start ? (a._start as any).getTime() : 0;
    const startB = b._start ? (b._start as any).getTime() : 0;
    return startB - startA;
  }

  toggleTableCollapse(): void {
    this.isTableCollapsed = !this.isTableCollapsed;
  }

  /**
   * Procesa los PTs comparativos entre OS, DCC/DIE y CRM para los proyectos filtrados (PH y PC)
   */
  calculatePtCounts(): void {
    const phMap: Record<string, PtComparisonItem> = {};
    const pcMap: Record<string, PtComparisonItem> = {};

    const getOrCreate = (
      map: Record<string, PtComparisonItem>,
      rawKey: string,
    ): PtComparisonItem => {
      const text = (rawKey || '').toString().trim();
      let label = 'Sin PT';

      // Solo cuando sea PT-XX siendo un número entre 01 al 99
      // PT-OTRO, OTRO, NA o cualquier otro valor cuentan como "Sin PT"
      const match =
        text.match(/^PT[\s\-_]*0*([1-9]\d?)$/i) || text.match(/^0*([1-9]\d?)$/);

      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num >= 1 && num <= 99) {
          label = `PT-${String(num).padStart(2, '0')}`;
        }
      }

      if (!map[label]) {
        map[label] = {
          pt: label,
          os: 0,
          dcc: 0,
          crm: 0,
          total: 0,
          proyectosOS: [],
          proyectosDCC: [],
          proyectosCRM: [],
        };
      }
      return map[label];
    };

    for (const meeting of this.filteredMeetings) {
      const isPC =
        meeting.tableSource === 'opportunity_calpro' ||
        (meeting.projectKey || meeting.name || '')
          .toUpperCase()
          .startsWith('PC');

      const targetMap = isPC ? pcMap : phMap;
      const projectName =
        meeting.name || meeting.projectKey || meeting.id || 'Sin nombre';

      // 1. OS: contar DUTs con su respectivo PT
      const osPts: string[] = meeting.os_raw_pts || [];
      for (const pt of osPts) {
        const entry = getOrCreate(targetMap, pt);
        entry.os++;
        entry.proyectosOS.push(projectName);
      }

      // 2. DCC/DIE: certificados dcc_data
      const certs: string[] = meeting.certificates || [];
      for (const cert of certs) {
        const certName = String(cert || '').trim();
        const match = isPC
          ? certName.match(this.pcPtRegex)
          : certName.match(this.phPtRegex);
        const key = match && match[1] ? match[1] : 'Sin PT';
        const entry = getOrCreate(targetMap, key);
        entry.dcc++;
        entry.proyectosDCC.push(projectName);
      }

      // 3. CRM: archivos adjuntos
      const attachments: string[] = meeting.attachments || [];
      for (const file of attachments) {
        const fileName = String(file || '').trim();
        const match = isPC
          ? fileName.match(this.pcPtRegex)
          : fileName.match(this.phPtRegex);
        const key = match && match[1] ? match[1] : 'Sin PT';
        const entry = getOrCreate(targetMap, key);
        entry.crm++;
        entry.proyectosCRM.push(projectName);
      }
    }

    // Calcular total (os + dcc + crm) para cada entrada
    [phMap, pcMap].forEach((map) => {
      Object.values(map).forEach((item) => {
        item.total = item.os + item.dcc + item.crm;
      });
    });

    this.phPtCounts = this.formatAndSortPtMap(phMap);
    this.pcPtCounts = this.formatAndSortPtMap(pcMap);

    this.phTotalCount = this.phPtCounts.reduce(
      (sum, item) => sum + item.total,
      0,
    );
    this.pcTotalCount = this.pcPtCounts.reduce(
      (sum, item) => sum + item.total,
      0,
    );
  }

  calculateAttachmentPtCounts(): void {
    this.calculatePtCounts();
  }

  getTotals(items: PtComparisonItem[]) {
    return items.reduce(
      (acc, item) => {
        acc.os += item.os;
        acc.dcc += item.dcc;
        acc.crm += item.crm;
        acc.total += item.total;
        return acc;
      },
      { os: 0, dcc: 0, crm: 0, total: 0 },
    );
  }

  abrirModalPT(item: PtComparisonItem): void {
    this.ptSeleccionado = item;

    // Conteo de frecuencia por proyecto en cada fuente
    const freqOS: Record<string, number> = {};
    (item.proyectosOS || []).forEach((name) => {
      freqOS[name] = (freqOS[name] || 0) + 1;
    });

    const freqDCC: Record<string, number> = {};
    (item.proyectosDCC || []).forEach((name) => {
      freqDCC[name] = (freqDCC[name] || 0) + 1;
    });

    const freqCRM: Record<string, number> = {};
    (item.proyectosCRM || []).forEach((name) => {
      freqCRM[name] = (freqCRM[name] || 0) + 1;
    });

    const todosProyectos = Array.from(
      new Set([
        ...(item.proyectosOS || []),
        ...(item.proyectosDCC || []),
        ...(item.proyectosCRM || []),
      ]),
    ).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    );

    this.proyectosComparativosModal = todosProyectos.map((nombre) => {
      const countOS = freqOS[nombre] || 0;
      const countDCC = freqDCC[nombre] || 0;
      const countCRM = freqCRM[nombre] || 0;

      // Discrepancia si los contadores mayores a cero difieren entre sí (ej. countOS !== countCRM)
      const nonZero = [countOS, countDCC, countCRM].filter((c) => c > 0);
      const hasDiscrepancy =
        nonZero.length > 1 && !nonZero.every((c) => c === nonZero[0]);

      return {
        nombre,
        countOS,
        countDCC,
        countCRM,
        hasDiscrepancy,
      };
    });

    this.mostrarModalPT = true;
  }

  cerrarModalPT(): void {
    this.mostrarModalPT = false;
    this.ptSeleccionado = null;
    this.proyectosComparativosModal = [];
  }

  seleccionarProyectoDesdeModal(nombreProyecto: string): void {
    this.cerrarModalPT();
    this.filterProjectText = nombreProyecto;
    this.isTableCollapsed = false;
    this.applyFilter();
  }

  /**
   * Ordena del 01 al 99, ubica 'Sin PT' al final y filtra conteos con total > 0
   */
  private formatAndSortPtMap(
    map: Record<string, PtComparisonItem>,
  ): PtComparisonItem[] {
    const result: PtComparisonItem[] = [];

    const sortedKeys = Object.keys(map)
      .filter((key) => key !== 'Sin PT' && map[key].total > 0)
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });

    for (const key of sortedKeys) {
      result.push(map[key]);
    }

    if (map['Sin PT'] && map['Sin PT'].total > 0) {
      result.push(map['Sin PT']);
    }

    return result;
  }

  getCrmUrl(project: any): string {
    const isCalpro =
      project?.tableSource === 'opportunity_calpro' ||
      (project?.projectKey || '').toString().toUpperCase().startsWith('PC');
    const entityPath = isCalpro
      ? '#OpportunityCalpro/view/'
      : '#Opportunity/view/';
    const id = project?.projectKey || project?.id || '';
    return `${this.crmBaseUrl}/CRM/${entityPath}${id}`;
  }
}
