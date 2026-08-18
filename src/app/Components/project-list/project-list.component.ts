import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../api/api.service';
import { UrlClass } from '../../shared/models/url.model';

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
  selectedStage: string = 'Todos';

  stageOptions: string[] = [
    'Todos',
    'Por Cotizar',
    'Revisión',
    'Cotización Enviada',
    'Seguimiento',
    'Presupuesto',
    'Fecha estimada',
    'Negociación',
    'Realizado',
    'Finalizado',
    'Finalizado y Realizado',
  ];
  projectTypeOptions: string[] = [
    'Todos',
    'Calibración',
    'GIS',
    'Otros',
    'Cable AT',
    'Cable MT',
    'PHENIX',
  ];
  filterProjectText: string = '';

  meetings: any[] = [];
  filteredMeetings: any[] = [];
  loading: boolean = false;
  certificatesByProject: Record<string, string[]> = {};
  totalUniqueCertificates: number = 0;
  uniqueProjectCount: number = 0;

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.initYears();
    this.loadMeetings();
  }

  private initYears() {
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

  private loadMeetings(): void {
    this.loading = true;

    const getNotes1 = {
      action: 'get',
      bd: 'hvtest2',
      table: 'note',
      opts: {
        attributes: ['parent_id', 'parent_type', 'created_at', 'data'],
        where: {
          parent_type: 'Opportunity',
          like: {
            data: '{"field":"stage","value":"Closed Won%'
          }
        },
        order_by: ['created_at', 'DESC']
      }
    };

    const getNotes2 = {
      action: 'get',
      bd: 'hvtest2',
      table: 'note',
      opts: {
        attributes: ['parent_id', 'parent_type', 'created_at', 'data'],
        where: {
          parent_type: 'OpportunityCalpro',
          like: {
            data: '%{"field":"stage","value":"Performed%'
          }
        },
        order_by: ['created_at', 'DESC']
      }
    };

    const getCertificates = {
      action: 'get',
      bd: 'calibraciones',
      table: 'dcc_data',
      opts: {
        attributes: ['id'],
        where: { deleted: 0 },
      },
    };

    forkJoin([
      this.apiService.post(getNotes1, UrlClass.URLNuevo),
      this.apiService.post(getNotes2, UrlClass.URLNuevo),
      this.apiService.post(getCertificates, UrlClass.URLNuevo),
    ]).subscribe({
      next: async ([notes1Resp, notes2Resp, certResp]: any) => {
        const rawNotes1 = Array.isArray(notes1Resp?.result) ? notes1Resp.result : [];
        const rawNotes2 = Array.isArray(notes2Resp?.result) ? notes2Resp.result : [];
        
        // Combine notes
        const combinedNotes = [...rawNotes1, ...rawNotes2];
        
        // Sort by created_at DESC
        combinedNotes.sort((a: any, b: any) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });

        const rawCertificates = Array.isArray(certResp?.result)
          ? certResp.result
          : [];
        this.certificatesByProject =
          this.buildCertificatesByProject(rawCertificates);

        const filteredRawNotes = combinedNotes.filter((n: any) => {
          const prefix = (n?.parent_id || '')
            .toString()
            .trim()
            .slice(0, 2)
            .toUpperCase();
          return prefix === 'PH' || prefix === 'PC';
        });

        const projectKeys: string[] = Array.from(
          new Set(
            filteredRawNotes.map((n: any) => n.parent_id || '')
          )
        ) as string[];

        const projectMeta = await this.loadProjectMeta(projectKeys);

        this.meetings = filteredRawNotes
          .map((n: any) => {
            const projectKey = n.parent_id || '';
            const certificates = this.certificatesByProject[projectKey] || [];
            const meta = projectMeta[projectKey] || {
              name: '',
              type: '',
              stage: '',
              rawStage: '',
            };
            const displayName = meta.name || projectKey;
            
            return {
              name: displayName,
              projectKey,
              date_start_date: n.created_at,
              certificates,
              certificateCount: certificates.length,
              projectType: meta.type,
              projectStage: meta.stage,
              rawProjectStage: meta.rawStage,
              excludedByStage: this.isExcludedRawStage(meta.rawStage),
            };
          })
          .filter((m: any) => !m.excludedByStage);

        this.applyFilter();
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Error loading notes or certificates:', err);
        this.meetings = [];
        this.filteredMeetings = [];
        this.loading = false;
      },
    });
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

        if (this.selectedStage && this.selectedStage !== 'Todos') {
          if (this.selectedStage === 'Finalizado y Realizado') {
            return (
              (m.projectStage || '') === 'Finalizado' ||
              (m.projectStage || '') === 'Realizado'
            );
          }
          if ((m.projectStage || '') !== this.selectedStage) {
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
      .sort((a: any, b: any) => (a._start as any) - (b._start as any));



    // Calculate unique projects and total unique certificates (deduplicated by project key)
    const uniqueProjectKeys = new Set<string>();
    let totalCount = 0;
    for (const meeting of this.filteredMeetings) {
      const projectKey = meeting.projectKey;
      if (!uniqueProjectKeys.has(projectKey)) {
        uniqueProjectKeys.add(projectKey);
        totalCount += meeting.certificateCount;
      }
    }
    this.uniqueProjectCount = uniqueProjectKeys.size;
    this.totalUniqueCertificates = totalCount;
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

  private async loadProjectMeta(
    projectKeys: string[],
  ): Promise<
    Record<string, { name: string; type: string; stage: string; rawStage: string }>
  > {
    const metaByKey: Record<
      string,
      { name: string; type: string; stage: string; rawStage: string }
    > = {};
    const cache: Record<
      string,
      { name: string; type: string; stage: string; rawStage: string }
    > = {};

    const requests = projectKeys.map((projectKey) => {
      if (!projectKey) {
        return Promise.resolve();
      }
      const prefix = projectKey.slice(0, 2).toUpperCase();
      if (cache[projectKey]) {
        metaByKey[projectKey] = cache[projectKey];
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const isPh = prefix === 'PH';
        const table = isPh ? 'opportunity' : 'opportunity_calpro';
        const attributes = isPh ? ['name', 'dut', 'stage'] : ['name', 'stage'];
        const getProjectMeta = {
          action: 'get',
          bd: 'hvtest2',
          table,
          opts: {
            where: { id: projectKey },
            attributes,
          },
        };

        this.apiService.post(getProjectMeta, UrlClass.URLNuevo).subscribe({
          next: (response: any) => {
            const record = response?.result?.[0] || {};
            const name = record.name || '';
            const type = isPh ? record.dut || '' : 'Calibración';
            const rawStage = record.stage ? record.stage.toString().trim() : '';
            const stage = this.translateStage(rawStage);
            const data = { name, type, stage, rawStage };
            cache[projectKey] = data;
            metaByKey[projectKey] = data;
            resolve();
          },
          error: () => {
            cache[projectKey] = {
              name: '',
              type: isPh ? '' : 'Calibración',
              stage: '',
              rawStage: '',
            };
            metaByKey[projectKey] = cache[projectKey];
            resolve();
          },
        });
      });
    });

    await Promise.all(requests);
    return metaByKey;
  }

  private isExcludedRawStage(stage: string): boolean {
    const raw = (stage || '').toString().trim().toLowerCase();
    return ['cancelled', 'declined', 'closed'].some((prefix) =>
      raw.startsWith(prefix),
    );
  }

  private translateStage(stage: string): string {
    const normalized = (stage || '').toString().trim().toLowerCase();
    const translations: Record<string, string> = {
      quoting: 'Por Cotizar',
      checking: 'Revisión',
      'quote sent': 'Cotización Enviada',
      tracing: 'Seguimiento',
      budget: 'Presupuesto',
      'estimated date': 'Fecha estimada',
      negotiation: 'Negociación',
      'closed won': 'Adjudicado',
      accomplished: 'Realizado',
      performed: 'Realizado',
      'closed lost nepotism': 'No adjudicado Nepotismo',
      'closed lost price': 'No adjudicado Precio',
      'closed lost technical': 'No adjudicado Técnico',
      'closed lost time': 'No adjudicado Tiempo',
      'declined price': 'Declinado Precio',
      'declined technical': 'Declinado Técnico',
      'declined time': 'Declinado Tiempo',
      cancelled: 'Cancelado',
      finalized: 'Finalizado',
    };
    return translations[normalized] || stage;
  }

  private extractProjectKeyFromMeeting(name: string): string {
    const text = (name || '').toString().trim().toUpperCase();
    const match = text.match(/^([A-Z]{2}\d{4})/);
    return match ? match[1] : '';
  }

  private extractProjectKeyFromDccId(id: string): string {
    const text = (id || '').toString().trim().toUpperCase();
    const match = text.match(/^([A-Z]{2}\d{4})/);
    return match ? match[1] : '';
  }
}
