import { Injectable } from '@angular/core';

interface ScaleFactorData {
  prueba: number;
  tablas: {
    nivel: number | null;
    dut: (number | null)[];
    patron: (number | null)[];
  }[];
}

@Injectable({
  providedIn: 'root',
})
export class Pt23XmlGeneratorService {
  constructor() {}

  /**
   * Genera el XML de resultados para los Scale Factors
   */
  generateResultsXML(
    scaleFactorData: ScaleFactorData[],
    sfx: number,
    sfref: number
  ): string {
    let resultsXML = '';

    scaleFactorData.forEach((sf) => {
      const resultXML = this.generateScaleFactorResult(sf, sfx, sfref);
      resultsXML += resultXML;
    });

    return resultsXML;
  }

  /**
   * Genera un resultado individual para un Scale Factor
   */
  private generateScaleFactorResult(
    sf: ScaleFactorData,
    sfx: number,
    sfref: number
  ): string {
    // Filtrar solo niveles con datos válidos
    const nivelesValidos = sf.tablas.filter(
      (tabla) => tabla.nivel !== null && tabla.nivel > 0
    );

    if (nivelesValidos.length === 0) {
      return '';
    }

    // Generar arrays de datos
    const ranges = this.generateRanges(nivelesValidos);
    const measuredValues = this.generateMeasuredValues(nivelesValidos);
    const referenceValues = this.generateReferenceValues(nivelesValidos);
    const voltageErrors = this.generateVoltageErrors(
      nivelesValidos,
      sfx,
      sfref
    );
    const scaleFactors = this.generateScaleFactors(nivelesValidos, sfx, sfref); // Pasar sfx y sfref
    const uncertainties = this.generateUncertainties(
      nivelesValidos,
      sfx,
      sfref
    );

    // Calcular valores para Linearity Test
    const meanScaleFactor = this.calculateMeanScaleFactor(scaleFactors);
    const linearity = this.calculateLinearity(scaleFactors, meanScaleFactor);

    return `
				<dcc:result>
					<dcc:name>
						<dcc:content lang="en">Scale Factor Test ${
              sf.prueba > 1 ? sf.prueba : ''
            } Results</dcc:content>
					</dcc:name>
					<dcc:data>
						<dcc:list>
							<dcc:quantity refType="hv_range">
								<dcc:name>
									<dcc:content lang="en">Range</dcc:content>
								</dcc:name>
								<si:realListXMLList>
									<si:valueXMLList>${ranges}</si:valueXMLList>
									<si:unitXMLList>\\volt</si:unitXMLList>
								</si:realListXMLList>
							</dcc:quantity>
							<dcc:quantity refType="basic_measuredValue">
								<dcc:name>
									<dcc:content lang="en">Voltage Measured</dcc:content>
								</dcc:name>
								<si:realListXMLList>
									<si:valueXMLList>${measuredValues}</si:valueXMLList>
									<si:unitXMLList>\\volt</si:unitXMLList>
								</si:realListXMLList>
							</dcc:quantity>
							<dcc:quantity refType="basic_referenceValue">
								<dcc:name>
									<dcc:content lang="en">Ref. Voltage</dcc:content>
								</dcc:name>
								<si:realListXMLList>
									<si:valueXMLList>${referenceValues}</si:valueXMLList>
									<si:unitXMLList>\\volt</si:unitXMLList>
								</si:realListXMLList>
							</dcc:quantity>
							<dcc:quantity refType="basic_measurementError">
								<dcc:name>
									<dcc:content lang="en">Voltage Error</dcc:content>
								</dcc:name>
								<si:realListXMLList>
									<si:valueXMLList>${voltageErrors}</si:valueXMLList>
									<si:unitXMLList>\\one</si:unitXMLList>
									<si:measurementUncertaintyUnivariateXMLList>
										<si:expandedMUXMLList>
											<si:valueExpandedMUXMLList>${uncertainties}</si:valueExpandedMUXMLList>
											<si:coverageFactorXMLList>2</si:coverageFactorXMLList>
											<si:coverageProbabilityXMLList>0.95</si:coverageProbabilityXMLList>
										</si:expandedMUXMLList>
									</si:measurementUncertaintyUnivariateXMLList>
								</si:realListXMLList>
							</dcc:quantity>
							<dcc:quantity refType="hv_scaleFactor">
								<dcc:name>
									<dcc:content lang="en">Obtained Scale Factor</dcc:content>
								</dcc:name>
								<si:realListXMLList>
									<si:valueXMLList>${scaleFactors}</si:valueXMLList>
									<si:unitXMLList>\\one</si:unitXMLList>
								</si:realListXMLList>
							</dcc:quantity>
						</dcc:list>
					</dcc:data>
				</dcc:result>
				<dcc:result refType="hv_linearity">
					<dcc:name>
						<dcc:content lang="en">Scale Factor ${
              sf.prueba > 1 ? sf.prueba + ' ' : ''
            }Mean Value</dcc:content>
					</dcc:name>
					<dcc:data>
						<dcc:quantity refType="hv_meanScaleFactor">
							<dcc:name>
								<dcc:content lang="en">Mean Value of Scale Factor Obtained</dcc:content>
							</dcc:name>
							<si:real>
								<si:value>${meanScaleFactor.toFixed(6)}</si:value>
								<si:unit>\\one</si:unit>
							</si:real>
						</dcc:quantity>
					</dcc:data>
				</dcc:result>
				<dcc:result refType="hv_linearity">
					<dcc:name>
						<dcc:content lang="en">Scale Factor ${
              sf.prueba > 1 ? sf.prueba + ' ' : ''
            }Linearity</dcc:content>
					</dcc:name>
					<dcc:data>
						<dcc:quantity refType="hv_linearity">
							<dcc:name>
								<dcc:content lang="en">Linearity of Scale Factor (voltage dependance) obtained</dcc:content>
							</dcc:name>
							<si:real>
								<si:value>${linearity.toFixed(6)}</si:value>
								<si:unit>\\one</si:unit>
							</si:real>
						</dcc:quantity>
					</dcc:data>
				</dcc:result>`;
  }

  /**
   * Genera el array de rangos (niveles en voltios)
   */
  private generateRanges(niveles: any[]): string {
    const ranges = niveles.map((tabla) => {
      const nivelKV = tabla.nivel!;
      const nivelV = nivelKV * 1000; // Convertir kV a V
      return Math.round(nivelV);
    });

    return ranges.join(' ');
  }

  /**
   * Genera los valores medidos (promedio DUT en voltios)
   * Usa directamente el promedio calculado de la BD y lo convierte de kV a V
   */
  private generateMeasuredValues(niveles: any[]): string {
    const measuredValues = niveles.map((tabla) => {
      // Si el nivel tiene promedio_dut de la BD, usarlo
      // IMPORTANTE: Los valores en BD están en kV, convertir a V
      const promedioDutKV = tabla.promedio_dut
        ? parseFloat(tabla.promedio_dut)
        : this.calcularPromedio(tabla.dut);

      const promedioDutV = promedioDutKV * 1000; // Convertir kV a V
      return Math.round(promedioDutV);
    });

    return measuredValues.join(' ');
  }

  /**
   * Genera los valores de referencia (promedio Patrón en voltios)
   * Usa directamente el promedio calculado de la BD y lo convierte de kV a V
   */
  private generateReferenceValues(niveles: any[]): string {
    const referenceValues = niveles.map((tabla) => {
      // Si el nivel tiene promedio_patron de la BD, usarlo
      // IMPORTANTE: Los valores en BD están en kV, convertir a V
      const promedioPatronKV = tabla.promedio_patron
        ? parseFloat(tabla.promedio_patron)
        : this.calcularPromedio(tabla.patron);

      const promedioPatronV = promedioPatronKV * 1000; // Convertir kV a V
      return Math.round(promedioPatronV);
    });

    return referenceValues.join(' ');
  }

  /**
   * Genera los errores de voltaje (en porcentaje)
   * Fórmula: ((DUT - Patron) / Patron) * 100
   */
  private generateVoltageErrors(
    niveles: any[],
    sfx: number,
    sfref: number
  ): string {
    const errors = niveles.map((tabla) => {
      const promedioDut = this.calcularPromedio(tabla.dut);
      const promedioPatron = this.calcularPromedio(tabla.patron);

      if (promedioPatron === 0) return 0;

      const error = ((promedioDut - promedioPatron) / promedioPatron) * 100;
      return error.toFixed(2);
    });

    return errors.join(' ');
  }

  /**
   * Genera los Scale Factors obtenidos
   * Fórmula simplificada: SF = patron / (dut / SFx)
   * El SF del nivel = promedio de todos los SF_corregidos
   */
  private generateScaleFactors(
    niveles: any[],
    sfx: number,
    sfref: number
  ): string {
    const scaleFactors = niveles.map((tabla) => {
      const sfObtenido = this.calcularScaleFactorCorregido(tabla, sfx, sfref);
      return sfObtenido.toFixed(6);
    });

    return scaleFactors.join(' ');
  }

  /**
   * Calcula el Scale Factor corregido para un nivel
   * Fórmula simplificada: SF = patron / (dut / SFx)
   * Retorna el promedio de todos los SF calculados
   */
  private calcularScaleFactorCorregido(
    tabla: any,
    sfx: number,
    sfref: number
  ): number {
    const sfCalculados: number[] = [];

    // Iterar sobre cada medición (hasta 10)
    for (let i = 0; i < 10; i++) {
      const valorDUT = tabla.dut[i];
      const valorPatron = tabla.patron[i];

      // Solo calcular si ambos valores existen y son válidos
      if (
        valorDUT !== null &&
        valorDUT !== undefined &&
        !isNaN(Number(valorDUT)) &&
        valorPatron !== null &&
        valorPatron !== undefined &&
        !isNaN(Number(valorPatron)) &&
        Number(valorDUT) !== 0 &&
        sfx !== 0
      ) {
        // Fórmula simplificada: SF = patron / (dut / SFx)
        const sf = Number(valorPatron) / (Number(valorDUT) / sfx);
        sfCalculados.push(sf);
      }
    }

    // Si no hay mediciones válidas, retornar 1
    if (sfCalculados.length === 0) {
      return 1.0;
    }

    // Retornar el promedio de todos los SF calculados
    const sfPromedio =
      sfCalculados.reduce((a, b) => a + b, 0) / sfCalculados.length;

    return sfPromedio;
  }

  /**
   * Calcula la incertidumbre expandida usando la fórmula del laboratorio
   * Fórmula: (valor_patron * SFref) / (valor_dut * 1000 / SFx)
   */
  private calcularIncertidumbre(
    nivelKV: number,
    error: number,
    tabla: any,
    sfx: number,
    sfref: number
  ): number {
    // Obtener promedios de la BD o calcularlos
    const promedioDUTkV = tabla.promedio_dut
      ? parseFloat(tabla.promedio_dut)
      : this.calcularPromedio(tabla.dut);

    const promedioPatronkV = tabla.promedio_patron
      ? parseFloat(tabla.promedio_patron)
      : this.calcularPromedio(tabla.patron);

    // Convertir kV a V
    const valor_patron = promedioPatronkV * 1000; // En voltios
    const valor_dut = promedioDUTkV * 1000; // En voltios

    // Aplicar la fórmula: (valor_patron * SFref) / (valor_dut * 1000 / SFx)
    if (valor_dut === 0 || sfx === 0) {
      return 1.0; // Valor por defecto
    }

    const uncertainty = (valor_patron * sfref) / (valor_dut * (1000 / sfx));

    return uncertainty;
  }

  /**
   * Genera las incertidumbres expandidas
   * Por ahora usa la desviación estándar de las mediciones
   */
  private generateUncertainties(
    niveles: any[],
    sfx: number,
    sfref: number
  ): string {
    const uncertainties = niveles.map((tabla) => {
      // Usar la desviación estándar de la BD si existe
      const desviacionDUT = tabla.desviacion_std_dut
        ? parseFloat(tabla.desviacion_std_dut)
        : null;

      const desviacionPatron = tabla.desviacion_std_patron
        ? parseFloat(tabla.desviacion_std_patron)
        : null;

      // Calcular incertidumbre basada en las desviaciones estándar
      // Fórmula simplificada: usar la mayor desviación como base
      let uncertainty = 1.0; // Valor por defecto 1%

      if (desviacionDUT !== null && desviacionPatron !== null) {
        // Combinar las desviaciones (ejemplo simplificado)
        const desviacionCombinada = Math.sqrt(
          Math.pow(desviacionDUT, 2) + Math.pow(desviacionPatron, 2)
        );

        // Convertir a porcentaje y multiplicar por k=2 para expandida
        const promedioDUT = tabla.promedio_dut
          ? parseFloat(tabla.promedio_dut)
          : 1;
        uncertainty = (desviacionCombinada / promedioDUT) * 100 * 2;
      }

      return Math.max(uncertainty, 0.5).toFixed(2); // Mínimo 0.5%
    });

    return uncertainties.join(' ');
  }

  /**
   * Calcula el promedio de un array, ignorando nulls
   */
  private calcularPromedio(valores: (number | null)[]): number {
    const validos = valores.filter(
      (v) => v !== null && v !== undefined && !isNaN(Number(v))
    ) as number[];
    if (validos.length === 0) return 0;
    const suma = validos.reduce((a, b) => a + b, 0);
    return suma / validos.length;
  }

  /**
   * Calcula el promedio del Scale Factor
   */
  private calculateMeanScaleFactor(scaleFactors: string): number {
    const values = scaleFactors.split(' ').map(Number);
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  /**
   * Calcula la linealidad del Scale Factor
   * Fórmula: (SFmax - SFmin) / SFmean * 100
   */
  private calculateLinearity(scaleFactors: string, meanSF: number): number {
    const values = scaleFactors.split(' ').map(Number);
    if (values.length === 0 || meanSF === 0) return 0;

    const max = Math.max(...values);
    const min = Math.min(...values);

    const linearity = ((max - min) / meanSF) * 100;
    return linearity;
  }

  /**
   * Genera el XML completo para visualización o descarga
   */
  generateCompleteXML(
    scaleFactorData: ScaleFactorData[],
    sfx: number,
    sfref: number
  ): string {
    const resultsXML = this.generateResultsXML(scaleFactorData, sfx, sfref);

    return `<?xml version="1.0" encoding="utf-8"?>
<!-- PT-23 Scale Factor Results -->
<!-- Generated: ${new Date().toISOString()} -->
<dcc:results xmlns:dcc="https://ptb.de/dcc" xmlns:si="https://ptb.de/si">
${resultsXML}
</dcc:results>`;
  }

  /**
   * Genera los resultados para agregar al componente Results
   * Retorna un array de objetos Result compatibles con el componente
   */
  generateResultsForComponent(
    scaleFactorData: any[],
    linearityTestData: any[],
    stabilityTestData: any[],
    sfx: number,
    sfref: number
  ): any[] {
    const results: any[] = [];

    // Procesar cada Scale Factor (prueba)
    scaleFactorData.forEach((sf, sfIndex) => {
      // Arrays para almacenar los datos de cada nivel
      const rangeValues: string[] = [];
      const dutValues: string[] = [];
      const patronValues: string[] = [];
      const errorValues: string[] = [];
      const uncertaintyValues: string[] = [];
      const scaleFactorValues: string[] = [];

      // Procesar cada nivel de tensión en este Scale Factor
      sf.tablas.forEach((tabla: any) => {
        const nivel = tabla.nivel || 0;

        // USAR PROMEDIOS DE LA BD SI EXISTEN
        const promedioDUTkV = tabla.promedio_dut
          ? parseFloat(tabla.promedio_dut)
          : this.calcularPromedio(tabla.dut);

        const promedioPatronkV = tabla.promedio_patron
          ? parseFloat(tabla.promedio_patron)
          : this.calcularPromedio(tabla.patron);

        // Convertir de kV a V
        const promedioDUT = promedioDUTkV * 1000;
        const promedioPatron = promedioPatronkV * 1000;

        // Agregar valores a los arrays
        rangeValues.push((nivel * 1000).toString());
        dutValues.push(Math.round(promedioDUT).toString());
        patronValues.push(Math.round(promedioPatron).toString());

        // Calcular error (%)
        const error = this.calcularError(promedioDUT, promedioPatron);
        errorValues.push(error.toFixed(2));

        // Calcular incertidumbre usando desviaciones estándar
        const desviacionDUT = tabla.desviacion_std_dut
          ? parseFloat(tabla.desviacion_std_dut)
          : null;

        const desviacionPatron = tabla.desviacion_std_patron
          ? parseFloat(tabla.desviacion_std_patron)
          : null;

        let uncertainty = 1.0;
        if (desviacionDUT !== null && desviacionPatron !== null) {
          const desviacionCombinada = Math.sqrt(
            Math.pow(desviacionDUT, 2) + Math.pow(desviacionPatron, 2)
          );
          uncertainty = (desviacionCombinada / promedioDUTkV) * 100 * 2;
        }
        uncertaintyValues.push(Math.max(uncertainty, 0.5).toFixed(2));

        // Calcular Scale Factor obtenido usando la fórmula correcta
        const scaleFactor = this.calcularScaleFactorCorregido(
          tabla,
          sfx,
          sfref
        );
        scaleFactorValues.push(scaleFactor.toFixed(3));
      });

      // Validar que hay datos válidos
      if (rangeValues.length === 0) {
        return;
      }

      // Crear el resultado para este Scale Factor
      results.push({
        id: this.generateId(),
        name: `SF ${sf.prueba} - Table Results`,
        refType: 'hv_scaleFactorTest',
        data: [
          {
            id: this.generateId(),
            refType: 'hv_range',
            name: 'Range',
            dataType: 'realListXMLList',
            valueXMLList: rangeValues.join(' '),
            unitXMLList: '\\volt',
            value: '',
            unit: '',
          },
          {
            id: this.generateId(),
            refType: 'basic_measuredValue',
            name: 'Voltage Measured',
            dataType: 'realListXMLList',
            valueXMLList: dutValues.join(' '),
            unitXMLList: '\\volt',
            value: '',
            unit: '',
          },
          {
            id: this.generateId(),
            refType: 'basic_referenceValue',
            name: 'Ref. Voltage',
            dataType: 'realListXMLList',
            valueXMLList: patronValues.join(' '),
            unitXMLList: '\\volt',
            value: '',
            unit: '',
          },
          {
            id: this.generateId(),
            refType: 'basic_measurementError',
            name: 'Voltage Error',
            dataType: 'realListXMLList',
            valueXMLList: errorValues.join(' '),
            unitXMLList: '\\one',
            value: '',
            unit: '',
            measurementUncertainty: {
              expandedMU: {
                valueExpandedMUXMLList: uncertaintyValues.join(' '),
                coverageFactorXMLList: '2',
                coverageProbabilityXMLList: '0.95',
              },
            },
          },
          {
            id: this.generateId(),
            refType: 'hv_scaleFactor',
            name: 'Obtained Scale Factor',
            dataType: 'realListXMLList',
            valueXMLList: scaleFactorValues.join(' '),
            unitXMLList: '\\one',
            value: '',
            unit: '',
          },
        ],
      });

      // Calcular y agregar Mean Scale Factor
      const meanSF = this.calcularPromedioArray(scaleFactorValues.map(Number));
      results.push({
        id: this.generateId(),
        name: `SF ${sf.prueba} - Mean Scale Factor`,
        refType: 'hv_scaleFactorMean',
        data: [
          {
            id: this.generateId(),
            refType: 'hv_meanScaleFactor',
            name: 'Mean Value of Scale Factor Obtained',
            dataType: 'real',
            valueXMLList: '',
            unitXMLList: '',
            value: meanSF.toFixed(3),
            unit: '\\one',
          },
        ],
      });

      // Calcular y agregar Linearity
      const linearity = this.calcularLinealidad(scaleFactorValues.map(Number));
      results.push({
        id: this.generateId(),
        name: `SF ${sf.prueba} - Linearity Test`,
        refType: 'hv_linearity',
        data: [
          {
            id: this.generateId(),
            refType: 'hv_linearity',
            name: 'Linearity of Scale Factor (voltage dependence) obtained',
            dataType: 'real',
            valueXMLList: '',
            unitXMLList: '',
            value: linearity.toFixed(2),
            unit: '\\one',
          },
        ],
      });
    });

    // ═══════════════════════════════════════════════════════
    // LINEARITY TEST (LT) - GENERA 3 RESULTADOS POR PRUEBA
    // ═══════════════════════════════════════════════════════
    linearityTestData.forEach((lt, ltIndex) => {
      const rangeValues: string[] = [];
      const dutValues: string[] = [];
      const patronValues: string[] = [];
      const errorValues: string[] = [];
      const uncertaintyValues: string[] = [];
      const scaleFactorValues: string[] = [];

      lt.tablas.forEach((tabla: any) => {
        const nivel = tabla.nivel || 0;
        const promedioDUTkV = tabla.promedio_dut
          ? parseFloat(tabla.promedio_dut)
          : this.calcularPromedio(tabla.dut);
        const promedioPatronkV = tabla.promedio_patron
          ? parseFloat(tabla.promedio_patron)
          : this.calcularPromedio(tabla.patron);
        const promedioDUT = promedioDUTkV * 1000;
        const promedioPatron = promedioPatronkV * 1000;

        rangeValues.push((nivel * 1000).toString());
        dutValues.push(Math.round(promedioDUT).toString());
        patronValues.push(Math.round(promedioPatron).toString());

        const error = this.calcularError(promedioDUT, promedioPatron);
        errorValues.push(error.toFixed(2));

        const desviacionDUT = tabla.desviacion_std_dut
          ? parseFloat(tabla.desviacion_std_dut)
          : null;
        const desviacionPatron = tabla.desviacion_std_patron
          ? parseFloat(tabla.desviacion_std_patron)
          : null;

        let uncertainty = 1.0;
        if (desviacionDUT !== null && desviacionPatron !== null) {
          const desviacionCombinada = Math.sqrt(
            Math.pow(desviacionDUT, 2) + Math.pow(desviacionPatron, 2)
          );
          uncertainty = (desviacionCombinada / promedioDUTkV) * 100 * 2;
        }
        uncertaintyValues.push(Math.max(uncertainty, 0.5).toFixed(2));

        // Calcular Scale Factor obtenido para LT
        const scaleFactor = this.calcularScaleFactorCorregido(
          tabla,
          sfx,
          sfref
        );
        scaleFactorValues.push(scaleFactor.toFixed(3));
      });

      if (rangeValues.length === 0) return;

      // RESULTADO 1: Tabla de datos LT
      results.push({
        id: this.generateId(),
        name: `LT ${lt.prueba} - Linearity Test Results`,
        refType: 'hv_linearityTest',
        data: [
          {
            id: this.generateId(),
            refType: 'hv_range',
            name: 'Range',
            dataType: 'realListXMLList',
            valueXMLList: rangeValues.join(' '),
            unitXMLList: '\\volt',
            value: '',
            unit: '',
          },
          {
            id: this.generateId(),
            refType: 'basic_measuredValue',
            name: 'Voltage Measured',
            dataType: 'realListXMLList',
            valueXMLList: dutValues.join(' '),
            unitXMLList: '\\volt',
            value: '',
            unit: '',
          },
          {
            id: this.generateId(),
            refType: 'basic_referenceValue',
            name: 'Ref. Voltage',
            dataType: 'realListXMLList',
            valueXMLList: patronValues.join(' '),
            unitXMLList: '\\volt',
            value: '',
            unit: '',
          },
          {
            id: this.generateId(),
            refType: 'basic_measurementError',
            name: 'Voltage Error',
            dataType: 'realListXMLList',
            valueXMLList: errorValues.join(' '),
            unitXMLList: '\\one',
            value: '',
            unit: '',
            measurementUncertainty: {
              expandedMU: {
                valueExpandedMUXMLList: uncertaintyValues.join(' '),
                coverageFactorXMLList: '2',
                coverageProbabilityXMLList: '0.95',
              },
            },
          },
          {
            id: this.generateId(),
            refType: 'hv_scaleFactor',
            name: 'Obtained Scale Factor',
            dataType: 'realListXMLList',
            valueXMLList: scaleFactorValues.join(' '),
            unitXMLList: '\\one',
            value: '',
            unit: '',
          },
        ],
      });

      // RESULTADO 2: Mean Scale Factor para LT
      const meanSF = this.calcularPromedioArray(scaleFactorValues.map(Number));
      results.push({
        id: this.generateId(),
        name: `LT ${lt.prueba} - Mean Value of Scale Factor Obtained`,
        refType: 'hv_linearityMean',
        data: [
          {
            id: this.generateId(),
            refType: 'hv_meanScaleFactor',
            name: 'Mean Value of Scale Factor Obtained',
            dataType: 'real',
            valueXMLList: '',
            unitXMLList: '',
            value: meanSF.toFixed(3),
            unit: '\\one',
          },
        ],
      });

      // RESULTADO 3: Linearity of Scale Factor para LT
      const linearity = this.calcularLinealidad(scaleFactorValues.map(Number));
      results.push({
        id: this.generateId(),
        name: `LT ${lt.prueba} - Linearity of Scale Factor`,
        refType: 'hv_linearityValue',
        data: [
          {
            id: this.generateId(),
            refType: 'hv_linearity',
            name: 'Linearity of Scale Factor (voltage dependence) obtained',
            dataType: 'real',
            valueXMLList: '',
            unitXMLList: '',
            value: linearity.toFixed(2),
            unit: '\\one',
          },
        ],
      });
    });

    // ═══════════════════════════════════════════════════════
    // STABILITY TEST (ST) - GENERA 3 RESULTADOS POR PRUEBA
    // ═══════════════════════════════════════════════════════
    stabilityTestData.forEach((st, stIndex) => {
      const rangeValues: string[] = [];
      const dutValues: string[] = [];
      const patronValues: string[] = [];
      const errorValues: string[] = [];
      const uncertaintyValues: string[] = [];
      const stabilityValues: string[] = [];
      const scaleFactorValues: string[] = [];

      st.tablas.forEach((tabla: any) => {
        const nivel = tabla.nivel || 0;
        const promedioDUTkV = tabla.promedio_dut
          ? parseFloat(tabla.promedio_dut)
          : this.calcularPromedio(tabla.dut);
        const promedioPatronkV = tabla.promedio_patron
          ? parseFloat(tabla.promedio_patron)
          : this.calcularPromedio(tabla.patron);
        const promedioDUT = promedioDUTkV * 1000;
        const promedioPatron = promedioPatronkV * 1000;

        rangeValues.push((nivel * 1000).toString());
        dutValues.push(Math.round(promedioDUT).toString());
        patronValues.push(Math.round(promedioPatron).toString());

        const error = this.calcularError(promedioDUT, promedioPatron);
        errorValues.push(error.toFixed(2));

        const desviacionDUT = tabla.desviacion_std_dut
          ? parseFloat(tabla.desviacion_std_dut)
          : null;
        const desviacionPatron = tabla.desviacion_std_patron
          ? parseFloat(tabla.desviacion_std_patron)
          : null;

        let uncertainty = 1.0;
        if (desviacionDUT !== null && desviacionPatron !== null) {
          const desviacionCombinada = Math.sqrt(
            Math.pow(desviacionDUT, 2) + Math.pow(desviacionPatron, 2)
          );
          uncertainty = (desviacionCombinada / promedioDUTkV) * 100 * 2;
        }
        uncertaintyValues.push(Math.max(uncertainty, 0.5).toFixed(2));

        // Calcular estabilidad como desviación relativa
        const stability =
          desviacionDUT !== null ? (desviacionDUT / promedioDUTkV) * 100 : 0;
        stabilityValues.push(stability.toFixed(2));

        // Calcular Scale Factor obtenido para ST
        const scaleFactor = this.calcularScaleFactorCorregido(
          tabla,
          sfx,
          sfref
        );
        scaleFactorValues.push(scaleFactor.toFixed(3));
      });

      if (rangeValues.length === 0) return;

      // RESULTADO 1: Tabla de datos ST
      results.push({
        id: this.generateId(),
        name: `ST ${st.prueba} - Short-term Stability Test Results`,
        refType: 'hv_stabilityTest',
        data: [
          {
            id: this.generateId(),
            refType: 'hv_range',
            name: 'Range',
            dataType: 'realListXMLList',
            valueXMLList: rangeValues.join(' '),
            unitXMLList: '\\volt',
            value: '',
            unit: '',
          },
          {
            id: this.generateId(),
            refType: 'basic_measuredValue',
            name: 'Voltage Measured',
            dataType: 'realListXMLList',
            valueXMLList: dutValues.join(' '),
            unitXMLList: '\\volt',
            value: '',
            unit: '',
          },
          {
            id: this.generateId(),
            refType: 'basic_referenceValue',
            name: 'Ref. Voltage',
            dataType: 'realListXMLList',
            valueXMLList: patronValues.join(' '),
            unitXMLList: '\\volt',
            value: '',
            unit: '',
          },
          {
            id: this.generateId(),
            refType: 'basic_measurementError',
            name: 'Voltage Error',
            dataType: 'realListXMLList',
            valueXMLList: errorValues.join(' '),
            unitXMLList: '\\one',
            value: '',
            unit: '',
            measurementUncertainty: {
              expandedMU: {
                valueExpandedMUXMLList: uncertaintyValues.join(' '),
                coverageFactorXMLList: '2',
                coverageProbabilityXMLList: '0.95',
              },
            },
          },
          {
            id: this.generateId(),
            refType: 'hv_stability',
            name: 'Short-term Stability',
            dataType: 'realListXMLList',
            valueXMLList: stabilityValues.join(' '),
            unitXMLList: '\\one',
            value: '',
            unit: '',
          },
        ],
      });

      // RESULTADO 2: Mean Scale Factor para ST
      const meanSF = this.calcularPromedioArray(scaleFactorValues.map(Number));
      results.push({
        id: this.generateId(),
        name: `ST ${st.prueba} - Mean Value of Scale Factor Obtained`,
        refType: 'hv_stabilityMean',
        data: [
          {
            id: this.generateId(),
            refType: 'hv_meanScaleFactor',
            name: 'Mean Value of Scale Factor Obtained',
            dataType: 'real',
            valueXMLList: '',
            unitXMLList: '',
            value: meanSF.toFixed(3),
            unit: '\\one',
          },
        ],
      });

      // RESULTADO 3: Short-term Stability Value
      const maxStability = Math.max(...stabilityValues.map(Number));
      results.push({
        id: this.generateId(),
        name: `ST ${st.prueba} - Short-term Stability Value`,
        refType: 'hv_stabilityValue',
        data: [
          {
            id: this.generateId(),
            refType: 'hv_stability',
            name: 'Short-term Stability (maximum deviation)',
            dataType: 'real',
            valueXMLList: '',
            unitXMLList: '',
            value: maxStability.toFixed(2),
            unit: '\\one',
          },
        ],
      });
    });

    return results;
  }

  private calcularPromedioArray(valores: number[]): number {
    if (valores.length === 0) return 0;
    const suma = valores.reduce((a, b) => a + b, 0);
    return suma / valores.length;
  }

  private calcularError(dutPromedio: number, patronPromedio: number): number {
    if (patronPromedio === 0) return 0;
    return ((dutPromedio - patronPromedio) / patronPromedio) * 100;
  }

  private calcularLinealidad(scaleFactors: number[]): number {
    if (scaleFactors.length === 0) return 0;
    const mean = this.calcularPromedioArray(scaleFactors);
    const deviations = scaleFactors.map((sf) => Math.abs(sf - mean) * 100);
    return Math.max(...deviations);
  }

  private generateId(): string {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
