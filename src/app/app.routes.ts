import { Routes } from '@angular/router';
import { HomeComponent } from './Components/home/home.component';
import { DccComponent } from './Components/dcc/dcc.component';
import { ProjectListComponent } from './Components/project-list/project-list.component';

export const routes: Routes = [
  { path: '', component: DccComponent },
  { path: 'view', component: DccComponent },
  { path: 'projects', component: ProjectListComponent },
];
