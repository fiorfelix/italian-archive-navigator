/**
 * Official data sources (SPEC §4). URLs, formats and licence were read from the official
 * pages on 2026-11-17; see data/SOURCES.md for what each refresh actually downloaded.
 */
export const ISTAT_LICENCE = {
  name: 'Creative Commons – Attribuzione – versione 4.0 (CC BY 4.0)',
  url: 'https://www.istat.it/note-legali/',
  /** Sentence that must still appear on the licence page; refresh fails if it disappears. */
  marker: 'tutti i contenuti pubblicati su questo sito sono soggetti alla licenza',
  text:
    'Salvo diversa indicazione, tutti i contenuti pubblicati su questo sito sono soggetti alla ' +
    'licenza Creative Commons – Attribuzione – versione 4.0.',
} as const;

export interface SourceDef {
  id: string;
  title: string;
  page_url: string;
  download_url: string;
  /** Header row as published, compared after collapsing whitespace. */
  expected_header: string[];
}

export const ISTAT_COMUNI: SourceDef = {
  id: 'istat_comuni',
  title: 'ISTAT – Codici statistici delle unità amministrative territoriali: elenco dei comuni',
  page_url:
    'https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/',
  download_url:
    'https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.xlsx',
  expected_header: [
    'Codice Regione',
    "Codice dell'Unità territoriale sovracomunale (valida a fini statistici)",
    'Codice Provincia (Storico)(1)',
    'Progressivo del Comune (2)',
    'Codice Comune formato alfanumerico',
    'Denominazione (Italiana e straniera)',
    'Denominazione in italiano',
    'Denominazione altra lingua',
    'Codice Ripartizione Geografica',
    'Ripartizione geografica',
    'Denominazione Regione',
    "Denominazione dell'Unità territoriale sovracomunale (valida a fini statistici)",
    'Tipologia di Unità territoriale sovracomunale',
    'Flag Comune capoluogo di Provincia/Città metropolitana/libero consorzio',
    'Sigla automobilistica',
    'Codice Comune formato numerico',
    'Codice Comune numerico con 107 Province (dal 2017 al 2025)',
    'Codice Comune numerico con 110 Province (dal 2010 al 2016)',
    'Codice Comune numerico con 107 Province (dal 2006 al 2009)',
    'Codice Comune numerico con 103 Province (dal 1995 al 2005)',
    'Codice Catastale del Comune',
    'Codice NUTS1 2021',
    'Codice NUTS2 2021 (3)',
    'Codice NUTS3 2021',
    'Codice NUTS1 2024',
    'Codice NUTS2 2024 (3)',
    'Codice NUTS3 2024',
  ],
};

/**
 * ISTAT Basi territoriali 2021: census localities. Field meanings from "Descrizione dei dati
 * Basi territoriali" (https://www.istat.it/wp-content/uploads/2024/07/Descrizione-dei-dati-Basi-territoriali.pdf):
 * TIPO_LOC 1 = centro abitato, 2 = nucleo abitato, 3 = località produttiva, 4 = case sparse;
 * CENTRO_CL = 1 for the comune's main centre. The CSV is tab-separated, Windows-1252.
 */
export const ISTAT_LOCALITA = {
  id: 'istat_localita_2021',
  title: 'ISTAT – Basi territoriali 2021: località (censimento 2021)',
  page_url: 'https://www.istat.it/notizia/basi-territoriali-e-variabili-censuarie/',
  download_url:
    'https://www.istat.it/storage/cartografia/basi_territoriali/2021/LocalitaPuntuali_21.zip',
  docs_url:
    'https://www.istat.it/wp-content/uploads/2024/07/Descrizione-dei-dati-Basi-territoriali.pdf',
  zip_entry_suffix: 'Localita_2021_Point.csv',
  expected_header: [
    'COD_REG',
    'COD_UTS',
    'PRO_COM',
    'LOC_ID',
    'LOC',
    'TIPO_LOC',
    'NOME',
    'CENTRO_CL',
    'ALTITUDINE',
    'POP21',
    'FAM21',
    'ABI21',
    'EDI21',
    'POINT_X',
    'POINT_Y',
  ],
} as const;

/**
 * SITUAS public report services, documented on the SITUAS "Dettaglio API" page
 * (https://situas.istat.it/web/#/apiDetail): GET reportspooljson?pfun=<id>&pdatada=&pdataa=
 * returns JSON; reportspooljsoncount returns the row count; anagrafica_report_metadato_web
 * returns the column definitions. Columns below were copied from that metadata on 2026-11-18.
 */
export const SITUAS_API_DOCS = 'https://situas.istat.it/web/#/apiDetail';
export const SITUAS_PUBLISH = 'https://situas-servizi.istat.it/publish';
export const SITUAS_FIRST_DATE = '17/03/1861';

export interface SituasReportDef {
  id: string;
  report_id: number;
  title: string;
  level: 'comune' | 'provincia';
  /** [column code in the JSON service, column label in the website CSV export] */
  columns: [string, string][];
}

export const SITUAS_REPORTS: SituasReportDef[] = [
  {
    id: 'situas_98',
    report_id: 98,
    title: 'Comuni soppressi o ceduti a stato estero',
    level: 'comune',
    columns: [
      ['ANNO', 'Anno evento'],
      ['SIGLA_UTS', 'Sigla Provincia/Uts'],
      ['COD_UTS', 'Codice Provincia/Uts'],
      ['PRO_COM_T', 'Codice Comune'],
      ['COD_CATASTO', 'Codice catasto'],
      ['COMUNE', 'Comune'],
      ['COMUNE_A', 'Comune (dizione straniera)'],
      ['FLAG_ES_SCORPORO', 'Flag Scorporo'],
      ['COD_VARIAZIONE', 'Tipo variazione'],
      ['DATA_INIZIO_AMMINISTRATIVA', 'Data evento'],
      ['PRO_COM_T_REL', 'Codice Comune associato'],
      ['COD_CATASTO_REL', 'Codice catasto associato'],
      ['COMUNE_REL', 'Comune associato'],
      ['COD_UTS_REL', 'Codice Provincia/Uts associato'],
      ['SIGLA_UTS_REL', 'Sigla Provincia/Uts associata'],
    ],
  },
  {
    id: 'situas_100',
    report_id: 100,
    title: 'Comuni costituiti o annessi da stato estero',
    level: 'comune',
    columns: [
      ['ANNO', 'Anno evento'],
      ['SIGLA_UTS', 'Sigla Provincia/Uts'],
      ['COD_UTS', 'Codice Provincia/Uts'],
      ['PRO_COM_T', 'Codice Comune'],
      ['COD_CATASTO', 'Codice catasto'],
      ['COMUNE', 'Comune'],
      ['COMUNE_A', 'Comune (dizione straniera)'],
      ['COD_VARIAZIONE_M', 'Tipo variazione'],
      ['DATA_INIZIO_AMMINISTRATIVA', 'Data evento'],
      ['PRO_COM_T_REL', 'Codice Comune associato'],
      ['COD_CATASTO_REL', 'Codice catasto associato'],
      ['COMUNE_REL', 'Comune associato'],
      ['COD_UTS_REL', 'Codice Provincia/Uts associato'],
      ['SIGLA_UTS_REL', 'Sigla Provincia/Uts associata'],
    ],
  },
  {
    id: 'situas_103',
    report_id: 103,
    title: 'Comuni con variazioni territoriali',
    level: 'comune',
    columns: [
      ['ANNO', 'Anno evento'],
      ['SIGLA_UTS', 'Sigla Provincia/Uts'],
      ['COD_UTS', 'Codice Provincia/Uts'],
      ['PRO_COM_T', 'Codice Comune'],
      ['COD_CATASTO', 'Codice catasto'],
      ['COMUNE', 'Comune'],
      ['COMUNE_A', 'Comune (dizione straniera)'],
      ['COD_VARIAZIONE', 'Tipo variazione'],
      ['DATA_INIZIO_AMMINISTRATIVA', 'Data evento'],
      ['PRO_COM_T_REL', 'Codice Comune'],
      ['COMUNE_REL', 'Comune associato'],
      ['COD_CATASTO_REL', 'Codice catasto associato'],
      ['COD_UTS_REL', 'Codice Provincia/Uts associato'],
      ['SIGLA_UTS_REL', 'Sigla Provincia/Uts associato'],
    ],
  },
  {
    id: 'situas_104',
    report_id: 104,
    title: 'Comuni con cambio denominazione',
    level: 'comune',
    columns: [
      ['ANNO', 'Anno evento'],
      ['SIGLA_UTS', 'Sigla Provincia/Uts'],
      ['COD_UTS', 'Codice Provincia/Uts'],
      ['PRO_COM_T', 'Codice Comune'],
      ['COMUNE', 'Denominazione precedente'],
      ['COMUNE_A', 'Denominazione precedente (straniera)'],
      ['DATA_INIZIO_AMMINISTRATIVA', 'Data evento'],
      ['COMUNE_REL', 'Nuova denominazione'],
      ['COMUNE_A_REL', 'Nuova denominazione (straniera)'],
      ['PRO_COM_T_REL', 'Codice Comune associato'],
      ['COD_UTS_REL', 'Codice Provincia/Uts associato'],
      ['SIGLA_UTS_REL', 'Sigla provincia/uts associata'],
    ],
  },
  {
    id: 'situas_105',
    report_id: 105,
    title: 'Comuni con variazione del codice statistico',
    level: 'comune',
    columns: [
      ['ANNO', 'Anno evento'],
      ['SIGLA_UTS', 'Sigla Provincia/Uts'],
      ['COD_UTS', 'Codice Provincia/Uts'],
      ['PRO_COM_T', 'Codice Comune'],
      ['COMUNE', 'Comune'],
      ['COMUNE_A', 'Comune (dizione straniera)'],
      ['COD_VARIAZIONE', 'Tipo variazione'],
      ['FLAG_CAMBIO_REGIONE', 'Flag cambio regione'],
      ['DATA_INIZIO_AMMINISTRATIVA', 'Data evento'],
      ['PRO_COM_T_REL', 'Nuovo codice Comune'],
      ['COMUNE_REL', 'Comune associato'],
      ['COD_UTS_REL', 'Codice Provincia/Uts associato'],
      ['SIGLA_UTS_REL', 'Sigla provincia/uts associata'],
    ],
  },
  {
    id: 'situas_112',
    report_id: 112,
    title: 'Province-Uts soppresse o cedute a stato estero',
    level: 'provincia',
    columns: [
      ['ANNO', 'Anno evento'],
      ['TIPO_UTS', 'Tipologia Provincia/Uts'],
      ['DESC_TIPO_UTS', 'Descrizione Tipologia'],
      ['COD_UTS', 'Codice Provincia/Uts'],
      ['DEN_UTS', 'Provincia/Uts'],
      ['SIGLA_UTS', 'Sigla Provincia/Uts'],
      ['COD_VARIAZIONE', 'Tipo variazione'],
      ['FLAG_ES_SCORPORO', 'Flag scorporo'],
      ['DATA_INIZIO_AMMINISTRATIVA', 'Data evento'],
      ['COD_UTS_REL', 'Codice Provincia/Uts associato'],
      ['DEN_UTS_REL', 'Provincia/Uts associata'],
      ['SIGLA_UTS_REL', 'Sigla Provincia/Uts associata'],
      ['TIPO_UTS_REL', 'Tipologia Provincia/Uts associata'],
      ['DESC_TIPO_UTS_REL', 'Descrizione tipologia associata'],
    ],
  },
  {
    id: 'situas_113',
    report_id: 113,
    title: 'Province-Uts costituite o annesse da Stato estero',
    level: 'provincia',
    columns: [
      ['ANNO', 'Anno evento'],
      ['TIPO_UTS', 'Tipologia Provincia/Uts'],
      ['DESC_TIPO_UTS', 'Descrizione Tipologia'],
      ['COD_UTS', 'Codice Provincia/Uts'],
      ['DEN_UTS', 'Provincia/Uts'],
      ['SIGLA_UTS', 'Sigla Provincia/Uts'],
      ['COD_VARIAZIONE', 'Tipo variazione'],
      ['DATA_INIZIO_AMMINISTRATIVA', 'Data evento'],
      ['COD_UTS_REL', 'Codice Provincia/Uts associata'],
      ['DEN_UTS_REL', 'Provincia/Uts associata'],
      ['SIGLA_UTS_REL', 'Sigla Provincia/Uts associata'],
      ['TIPO_UTS_REL', 'Tipologia Provincia/Uts associata'],
      ['DESC_TIPO_UTS_REL', 'Descrizione Tipologia associata'],
    ],
  },
  {
    id: 'situas_114',
    report_id: 114,
    title: 'Province-Uts con cambio denominazione',
    level: 'provincia',
    columns: [
      ['ANNO', 'Anno evento'],
      ['TIPO_UTS', 'Tipologia Provincia/Uts'],
      ['DESC_TIPO_UTS', 'Descrizione Tipologia'],
      ['SIGLA_UTS', 'Sigla Provincia/Uts'],
      ['COD_UTS', 'Codice Provincia/Uts'],
      ['DEN_UTS', 'Denominazione precedente'],
      ['DATA_INIZIO_AMMINISTRATIVA', 'Data evento'],
      ['DEN_UTS_REL', 'Nuova denominazione'],
      ['COD_UTS_REL', 'Codice Provincia/Uts associato'],
    ],
  },
];

const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
const period = () => `pdatada=${SITUAS_FIRST_DATE}&pdataa=${today()}`;

export const situasUrls = (r: SituasReportDef) => ({
  data: `${SITUAS_PUBLISH}/reportspooljson?pfun=${r.report_id}&${period()}`,
  count: `${SITUAS_PUBLISH}/reportspooljsoncount?pfun=${r.report_id}&${period()}`,
  metadata: `${SITUAS_PUBLISH}/anagrafica_report_metadato_web?pfun=${r.report_id}&${period()}`,
});

/** Plain-language meaning of each variation code, from the SITUAS column metadata. */
export const VARIATION_CODES: Record<string, string> = {
  ES: 'Estinzione (comune suppressed)',
  AS: 'Estinzione per cessione a stato estero (ceded to a foreign state)',
  CS: 'Costituzione (comune created)',
  AN: 'Costituzione per annessione da stato estero (became part of Italy by annexation)',
  AQES: 'Incorporazione del territorio di comuni soppressi (absorbed a suppressed comune)',
  AQ: 'Acquisizione di territorio (gained territory)',
  CE: 'Cessione di territorio (lost territory)',
  CECS: 'Cessione di territorio per costituzione di un nuovo comune (gave territory to a new comune)',
  AP: 'Cambio di appartenenza provincia (moved to another province)',
  CDAP: 'Cambio di provincia e contestuale cambio nome (moved province and renamed)',
  RN: 'Rinumerazione del codice statistico (ISTAT code renumbered)',
  CD: 'Cambio denominazione (renamed)',
  ESCT: 'Estinzione per cambio tipologia (ceased by change of type)',
  CSCT: 'Costituzione per cambio tipologia (created by change of type)',
};

/**
 * IndicePA open data (https://indicepa.gov.it/ipa-dati/), CKAN portal. Resource URLs are
 * looked up through the documented CKAN API (package_show) on each refresh; each dataset
 * publishes a metadata_*.json data dictionary, checked against the columns below
 * (copied from those dictionaries on 2026-11-18). Licence must stay CC-BY-4.0.
 */
export const INDICEPA_API = 'https://indicepa.gov.it/ipa-dati/api/3/action/package_show?id=';
export const INDICEPA_LICENCE_ID = 'CC-BY-4.0';

export interface IndicePaDef {
  id: string;
  package_id: string;
  title: string;
  page_url: string;
  data_format: 'XLSX' | 'TXT';
  columns: string[];
}

const ipa = (
  package_id: string,
  title: string,
  data_format: 'XLSX' | 'TXT',
  columns: string[],
): IndicePaDef => ({
  id: `indicepa_${package_id.replace(/-/g, '_')}`,
  package_id,
  title,
  page_url: `https://indicepa.gov.it/ipa-dati/dataset/${package_id}`,
  data_format,
  columns,
});

export const INDICEPA_ENTI = ipa('enti', 'IndicePA – Enti', 'XLSX', [
  'Codice_IPA',
  'Denominazione_ente',
  'Codice_fiscale_ente',
  'Tipologia',
  'Codice_Categoria',
  'Codice_natura',
  'Codice_ateco',
  'Ente_in_liquidazione',
  'Codice_MIUR',
  'Codice_ISTAT',
  'Acronimo',
  'Nome_responsabile',
  'Cognome_responsabile',
  'Titolo_responsabile',
  'Codice_comune_ISTAT',
  'Codice_catastale_comune',
  'CAP',
  'Indirizzo',
  'Mail1',
  'Tipo_Mail1',
  'Mail2',
  'Tipo_Mail2',
  'Mail3',
  'Tipo_Mail3',
  'Mail4',
  'Tipo_Mail4',
  'Mail5',
  'Tipo_Mail5',
  'Sito_istituzionale',
  'Url_facebook',
  'Url_linkedin',
  'Url_twitter',
  'Url_youtube',
  'Data_aggiornamento',
]);
export const INDICEPA_AOO = ipa('aoo', 'IndicePA – Aree Organizzative Omogenee (AOO)', 'TXT', [
  'cod_amm',
  'cod_aoo',
  'des_aoo',
  'dat_istituz',
  'Comune',
  'Cap',
  'Provincia',
  'Regione',
  'Indirizzo',
  'Tel',
  'nome_resp',
  'cogn_resp',
  'mail_resp',
  'tel_resp',
  'fax',
  'mail1',
  'tipo_mail1',
  'mail2',
  'tipo_mail2',
  'mail3',
  'tipo_mail3',
]);
export const INDICEPA_UO = ipa('unita-organizzative', 'IndicePA – Unità Organizzative', 'XLSX', [
  'Codice_IPA',
  'Denominazione_ente',
  'Codice_fiscale_ente',
  'Codice_uni_uo',
  'Codice_uni_aoo',
  'Codice_uni_uo_padre',
  'Descrizione_uo',
  'Data_istituzione',
  'Nome_responsabile',
  'Cognome_responsabile',
  'Mail_responsabile',
  'Telefono_responsabile',
  'Codice_comune_ISTAT',
  'Codice_catastale_comune',
  'CAP',
  'Indirizzo',
  'Telefono',
  'Fax',
  'Mail1',
  'Tipo_Mail1',
  'Mail2',
  'Tipo_Mail2',
  'Mail3',
  'Tipo_Mail3',
  'Data_aggiornamento',
  'Url',
]);
