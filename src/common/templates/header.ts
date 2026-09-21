import { Content } from 'pdfmake/interfaces';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface HeaderData {
  title: string;
  subtitle: string;
  date: string;
  hour: string;
  user: string;
}

const ENTITY_NAME = 'MUTUAL DE SERVICIOS AL POLICÍA "MUSERPOL"';

// Paleta de colores elegante
const COLORS = {
  primary: '#202020',   // Negro institucional profundo
  secondary: '#4A5568', // Gris pizarra para subtítulos
  border: '#E2E8F0',    // Borde suave y moderno
  line: '#CBD5E0',      // Línea divisoria sobria
  bgHeader: '#F7FAFC',  // Fondo tenue para etiquetas
};

function loadTemplateImage(): string | null {
  const possiblePaths = [
    join(__dirname, 'logo.png'),
    join(process.cwd(), 'src', 'common', 'templates', 'logo.png'),
    join(process.cwd(), 'dist', 'common', 'templates', 'logo.png'),
  ];

  const imagePath = possiblePaths.find(existsSync);
  if (!imagePath) return null;

  const base64 = readFileSync(imagePath).toString('base64');
  return `data:image/png;base64,${base64}`;
}

export function buildHeader(header: HeaderData): Content {
  const logo = loadTemplateImage();

  return {
    stack: [
      // =====================================================
      // LOGO | TÍTULOS Y ENTIDAD | INFORMACIÓN
      // =====================================================
      {
        columns: [
          // LOGO
          {
            width: '18%',
            stack: logo
              ? [
                  {
                    image: logo,
                    width: 65,
                    alignment: 'left',
                  },
                ]
              : [],
          },

          // ENTIDAD Y TÍTULOS (Agrupados para mejor balance visual)
          {
            width: '57%',
            stack: [
              {
                text: ENTITY_NAME,
                alignment: 'center',
                bold: true,
                fontSize: 9,
                color: COLORS.secondary,
                characterSpacing: 0.5,
              },
              {
                text: header.title.toUpperCase(),
                alignment: 'center',
                bold: true,
                fontSize: 13,
                color: COLORS.primary,
                margin: [0, 4, 0, 2],
              },
              {
                text: header.subtitle,
                alignment: 'center',
                fontSize: 8.5,
                color: COLORS.secondary,
              },
            ],
          },

          // TABLA DE DATOS METADATA
          {
            width: '25%',
            table: {
              widths: ['auto', '*'],
              body: [
                [
                  {
                    text: 'Fecha',
                    bold: true,
                    fontSize: 7,
                    color: COLORS.secondary,
                    fillColor: COLORS.bgHeader,
                  },
                  {
                    text: header.date,
                    fontSize: 7,
                    alignment: 'right',
                    color: '#2D3748',
                  },
                ],
                [
                  {
                    text: 'Hora',
                    bold: true,
                    fontSize: 7,
                    color: COLORS.secondary,
                    fillColor: COLORS.bgHeader,
                  },
                  {
                    text: header.hour,
                    fontSize: 7,
                    alignment: 'right',
                    color: '#2D3748',
                  },
                ],
                [
                  {
                    text: 'Usuario',
                    bold: true,
                    fontSize: 7,
                    color: COLORS.secondary,
                    fillColor: COLORS.bgHeader,
                  },
                  {
                    text: header.user,
                    fontSize: 7,
                    alignment: 'right',
                    color: '#2D3748',
                  },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => COLORS.border,
              vLineColor: () => COLORS.border,
              paddingLeft: () => 4,
              paddingRight: () => 4,
              paddingTop: () => 2,
              paddingBottom: () => 2,
            },
          },
        ],
        columnGap: 6,
      },

      // =====================================================
      // LÍNEA SEPARADORA ELEGANTE
      // =====================================================
      {
        table: {
          widths: ['*'],
          body: [['']],
        },
        layout: {
          hLineWidth: (i) => (i === 0 ? 1 : 0),
          vLineWidth: () => 0,
          hLineColor: () => COLORS.primary,
        },
        margin: [0, 6, 0, 0],
      },
    ],
  };
}