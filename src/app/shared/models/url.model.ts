export class UrlClass {
  //public static URLNav: string = 'http://' + window.location.host;

  //public static URL: string = 'http://192.168.1.200:81/administracion/api/';
  public static get isLocalNetwork(): boolean {
    if (typeof window === 'undefined') return false;
    const host = window.location.host;
    return host.includes('192.168.1') || host.includes('localhost') || host.includes('127.0.0.1');
  }

  public static URLNuevo: string = UrlClass.isLocalNetwork
    ? 'http://192.168.1.201:81/administracion/api/'
    : 'http://26.187.160.72:81/administracion/api/';
  public static URL: string = UrlClass.isLocalNetwork
    ? 'http://192.168.1.200:81/api/Nuevos/'
    : 'http://26.110.177.38:81/api/Nuevos/';

  // URL para generación de PDF - detecta localhost
  public pdfURL: string = UrlClass.isLocalNetwork
    ? 'http://192.168.1.201:81/DCC/'
    : 'http://26.187.160.72:81/DCC/';
}
