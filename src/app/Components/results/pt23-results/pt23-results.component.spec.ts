import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Pt23ResultsComponent } from './pt23-results.component';

describe('Pt23ResultsComponent', () => {
  let component: Pt23ResultsComponent;
  let fixture: ComponentFixture<Pt23ResultsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pt23ResultsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Pt23ResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
