import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdministrativeDataComponent } from './administrative-data.component';

describe('AdministrativeDataComponent', () => {
  let component: AdministrativeDataComponent;
  let fixture: ComponentFixture<AdministrativeDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdministrativeDataComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AdministrativeDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
