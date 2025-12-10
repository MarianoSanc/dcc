export class UrlClass {
  //public static URLNav: string = 'http://' + window.location.host;

  //public static URL: string = 'http://192.168.1.200:81/administracion/api/';
  public static URLNuevo: string = window.location.host.includes('192.168.1')
    ? 'http://192.168.1.201:81/administracion/api/'
    : 'http://26.187.160.72:81/administracion/api/';
  public static URL: string = window.location.host.includes('192.168.1')
    ? 'http://192.168.1.200:81/api/Nuevos/'
    : 'http://26.110.177.38:81/api/Nuevos/';

  // URL para generación de PDF - detecta localhost

  public pdfURL: string = window.location.host.includes('192.168.1')
    ? 'http://192.168.1.201:81/DCC/'
    : 'http://26.187.160.72:81/DCC/';
}
