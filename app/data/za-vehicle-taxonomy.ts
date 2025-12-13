export type VehicleCategory =
  | 'hatchback'
  | 'sedan'
  | 'suv'
  | 'bakkie'
  | 'mpv'
  | 'van'
  | 'coupe'
  | 'wagon'
  | 'convertible'
  | 'commercial'

export type CabType = 'single' | 'extended' | 'double'

export interface ZaVehicleModel {
  model: string
  aliases?: string[]
  category?: VehicleCategory
  engines?: string[]
  cabTypes?: CabType[]
}

export interface ZaVehicleMake {
  make: string
  aliases?: string[]
  models: ZaVehicleModel[]
}

export const ZA_CAB_TYPES: Array<{ value: CabType; label: string }> = [
  { value: 'single', label: 'Single Cab' },
  { value: 'extended', label: 'Extended Cab' },
  { value: 'double', label: 'Double Cab' },
]

export const ZA_VEHICLE_TAXONOMY: ZaVehicleMake[] = [
  {
    make: 'Toyota',
    models: [
      {
        model: 'Hilux',
        category: 'bakkie',
        engines: ['2.0', '2.4', '2.5', '2.7', '2.8', '3.0', '4.0'],
        cabTypes: ['single', 'extended', 'double'],
      },
      {
        model: 'Fortuner',
        category: 'suv',
        engines: ['2.4', '2.5', '2.7', '2.8', '3.0', '4.0'],
      },
      {
        model: 'Corolla',
        category: 'sedan',
        engines: ['1.3', '1.4', '1.6', '1.8', '2.0'],
      },
      {
        model: 'Corolla Cross',
        category: 'suv',
        engines: ['1.8', '2.0'],
      },
      {
        model: 'Yaris',
        category: 'hatchback',
        engines: ['1.0', '1.3', '1.5'],
      },
      {
        model: 'Etios',
        category: 'hatchback',
        engines: ['1.5'],
      },
      {
        model: 'Starlet',
        category: 'hatchback',
        engines: ['1.4', '1.5'],
      },
      {
        model: 'Urban Cruiser',
        category: 'suv',
        engines: ['1.5'],
      },
      {
        model: 'RAV4',
        category: 'suv',
        engines: ['2.0', '2.5'],
      },
      {
        model: 'Prado',
        aliases: ['Land Cruiser Prado'],
        category: 'suv',
        engines: ['2.7', '3.0', '4.0'],
      },
      {
        model: 'Land Cruiser 79',
        aliases: ['Land Cruiser 70'],
        category: 'bakkie',
        engines: ['4.2', '4.5'],
        cabTypes: ['single', 'double'],
      },
      {
        model: 'Land Cruiser 200',
        category: 'suv',
        engines: ['4.5'],
      },
      {
        model: 'Land Cruiser 300',
        category: 'suv',
        engines: ['3.3'],
      },
      {
        model: 'C-HR',
        category: 'suv',
        engines: ['1.2', '1.8'],
      },
      {
        model: 'Hiace',
        category: 'van',
        engines: ['2.5', '2.7', '2.8'],
      },
      {
        model: 'Avanza',
        category: 'mpv',
        engines: ['1.3', '1.5'],
      },
      {
        model: 'Rumion',
        category: 'mpv',
        engines: ['1.5'],
      },
      {
        model: 'Camry',
        category: 'sedan',
        engines: ['2.0', '2.5', '3.5'],
      },
      {
        model: 'Rush',
        category: 'suv',
        engines: ['1.5'],
      },
    ],
  },
  {
    make: 'Volkswagen',
    aliases: ['VW'],
    models: [
      {
        model: 'Polo',
        category: 'hatchback',
        engines: ['1.0', '1.2', '1.4', '1.6', '2.0'],
      },
      {
        model: 'Polo Vivo',
        category: 'hatchback',
        engines: ['1.4', '1.6'],
      },
      {
        model: 'Golf',
        category: 'hatchback',
        engines: ['1.4', '1.6', '2.0'],
      },
      {
        model: 'Tiguan',
        category: 'suv',
        engines: ['1.4', '2.0'],
      },
      {
        model: 'T-Cross',
        category: 'suv',
        engines: ['1.0'],
      },
      {
        model: 'T-Roc',
        category: 'suv',
        engines: ['1.4', '2.0'],
      },
      {
        model: 'Touareg',
        category: 'suv',
        engines: ['3.0'],
      },
      {
        model: 'Amarok',
        category: 'bakkie',
        engines: ['2.0', '3.0'],
        cabTypes: ['double'],
      },
      {
        model: 'Caddy',
        category: 'van',
        engines: ['1.6', '2.0'],
      },
      {
        model: 'Transporter',
        aliases: ['Kombi'],
        category: 'van',
        engines: ['2.0'],
      },
      {
        model: 'Jetta',
        category: 'sedan',
        engines: ['1.4', '1.6', '2.0'],
      },
      {
        model: 'Passat',
        category: 'sedan',
        engines: ['1.8', '2.0'],
      },
      {
        model: 'up!',
        aliases: ['Up'],
        category: 'hatchback',
        engines: ['1.0'],
      },
    ],
  },
  {
    make: 'Ford',
    models: [
      {
        model: 'Ranger',
        category: 'bakkie',
        engines: ['2.0', '2.2', '2.5', '3.2'],
        cabTypes: ['single', 'extended', 'double'],
      },
      {
        model: 'Everest',
        category: 'suv',
        engines: ['2.0', '2.2', '3.2'],
      },
      {
        model: 'EcoSport',
        category: 'suv',
        engines: ['1.0', '1.5', '2.0'],
      },
      {
        model: 'Fiesta',
        category: 'hatchback',
        engines: ['1.0', '1.4', '1.6'],
      },
      {
        model: 'Figo',
        category: 'hatchback',
        engines: ['1.4', '1.5'],
      },
      {
        model: 'Focus',
        category: 'hatchback',
        engines: ['1.0', '1.5', '2.0'],
      },
      {
        model: 'Kuga',
        category: 'suv',
        engines: ['1.5', '2.0'],
      },
      {
        model: 'Territory',
        category: 'suv',
        engines: ['1.8'],
      },
    ],
  },
  {
    make: 'Nissan',
    models: [
      {
        model: 'Navara',
        category: 'bakkie',
        engines: ['2.3', '2.5'],
        cabTypes: ['single', 'double'],
      },
      {
        model: 'NP200',
        category: 'bakkie',
        engines: ['1.6'],
        cabTypes: ['single'],
      },
      {
        model: 'NP300 Hardbody',
        aliases: ['Hardbody', 'NP300'],
        category: 'bakkie',
        engines: ['2.4', '2.5'],
        cabTypes: ['single', 'double'],
      },
      {
        model: 'Qashqai',
        category: 'suv',
        engines: ['1.2', '1.5', '2.0'],
      },
      {
        model: 'X-Trail',
        category: 'suv',
        engines: ['2.0', '2.5'],
      },
      {
        model: 'Magnite',
        category: 'suv',
        engines: ['1.0'],
      },
      {
        model: 'Almera',
        category: 'sedan',
        engines: ['1.5'],
      },
      {
        model: 'Micra',
        category: 'hatchback',
        engines: ['1.2', '1.5'],
      },
      {
        model: 'Juke',
        category: 'suv',
        engines: ['1.6'],
      },
      {
        model: 'Patrol',
        category: 'suv',
        engines: ['4.8', '5.6'],
      },
    ],
  },
  {
    make: 'Hyundai',
    models: [
      {
        model: 'i10',
        category: 'hatchback',
        engines: ['1.0', '1.1', '1.2'],
      },
      {
        model: 'Grand i10',
        category: 'hatchback',
        engines: ['1.0', '1.2'],
      },
      {
        model: 'i20',
        category: 'hatchback',
        engines: ['1.0', '1.2', '1.4'],
      },
      {
        model: 'Accent',
        category: 'sedan',
        engines: ['1.4', '1.6'],
      },
      {
        model: 'Venue',
        category: 'suv',
        engines: ['1.0'],
      },
      {
        model: 'Creta',
        category: 'suv',
        engines: ['1.5', '1.6'],
      },
      {
        model: 'Tucson',
        category: 'suv',
        engines: ['1.6', '2.0'],
      },
      {
        model: 'Santa Fe',
        category: 'suv',
        engines: ['2.2', '2.4', '3.3'],
      },
      {
        model: 'Kona',
        category: 'suv',
        engines: ['1.6', 'electric'],
      },
      {
        model: 'H-1',
        category: 'van',
        engines: ['2.5'],
      },
    ],
  },
  {
    make: 'Kia',
    models: [
      {
        model: 'Picanto',
        category: 'hatchback',
        engines: ['1.0', '1.2'],
      },
      {
        model: 'Rio',
        category: 'hatchback',
        engines: ['1.2', '1.4'],
      },
      {
        model: 'Sonet',
        category: 'suv',
        engines: ['1.0', '1.5'],
      },
      {
        model: 'Seltos',
        category: 'suv',
        engines: ['1.5', '1.6'],
      },
      {
        model: 'Sportage',
        category: 'suv',
        engines: ['1.6', '2.0', '2.4'],
      },
      {
        model: 'Sorento',
        category: 'suv',
        engines: ['2.2', '3.5'],
      },
      {
        model: 'Carnival',
        category: 'mpv',
        engines: ['2.2'],
      },
      {
        model: 'Cerato',
        category: 'sedan',
        engines: ['1.6', '2.0'],
      },
    ],
  },
  {
    make: 'Renault',
    models: [
      {
        model: 'Kwid',
        category: 'hatchback',
        engines: ['1.0'],
      },
      {
        model: 'Sandero',
        category: 'hatchback',
        engines: ['0.9', '1.0', '1.6'],
      },
      {
        model: 'Sandero Stepway',
        aliases: ['Stepway'],
        category: 'hatchback',
        engines: ['0.9', '1.0', '1.6'],
      },
      {
        model: 'Clio',
        category: 'hatchback',
        engines: ['0.9', '1.2', '1.6'],
      },
      {
        model: 'Duster',
        category: 'suv',
        engines: ['1.5', '1.6'],
      },
      {
        model: 'Kiger',
        category: 'suv',
        engines: ['1.0'],
      },
      {
        model: 'Captur',
        category: 'suv',
        engines: ['0.9', '1.2'],
      },
      {
        model: 'Megane',
        category: 'hatchback',
        engines: ['1.2', '1.4', '2.0'],
      },
      {
        model: 'Koleos',
        category: 'suv',
        engines: ['2.5'],
      },
    ],
  },
  {
    make: 'Suzuki',
    models: [
      {
        model: 'Swift',
        category: 'hatchback',
        engines: ['1.2', '1.4'],
      },
      {
        model: 'Swift Dzire',
        aliases: ['Dzire'],
        category: 'sedan',
        engines: ['1.2'],
      },
      {
        model: 'Baleno',
        category: 'hatchback',
        engines: ['1.4', '1.5'],
      },
      {
        model: 'Celerio',
        category: 'hatchback',
        engines: ['1.0'],
      },
      {
        model: 'S-Presso',
        category: 'hatchback',
        engines: ['1.0'],
      },
      {
        model: 'Ignis',
        category: 'hatchback',
        engines: ['1.2'],
      },
      {
        model: 'Vitara',
        category: 'suv',
        engines: ['1.5', '1.6'],
      },
      {
        model: 'Jimny',
        category: 'suv',
        engines: ['1.3', '1.5'],
      },
      {
        model: 'Ertiga',
        category: 'mpv',
        engines: ['1.5'],
      },
      {
        model: 'XL6',
        category: 'mpv',
        engines: ['1.5'],
      },
      {
        model: 'Grand Vitara',
        category: 'suv',
        engines: ['1.5'],
      },
    ],
  },
  {
    make: 'Mazda',
    models: [
      {
        model: 'Mazda2',
        category: 'hatchback',
        engines: ['1.3', '1.5'],
      },
      {
        model: 'Mazda3',
        category: 'hatchback',
        engines: ['1.6', '2.0'],
      },
      {
        model: 'CX-3',
        category: 'suv',
        engines: ['2.0'],
      },
      {
        model: 'CX-5',
        category: 'suv',
        engines: ['2.0', '2.2', '2.5'],
      },
      {
        model: 'CX-30',
        category: 'suv',
        engines: ['2.0'],
      },
      {
        model: 'BT-50',
        category: 'bakkie',
        engines: ['2.2', '3.0'],
        cabTypes: ['single', 'double'],
      },
    ],
  },
  {
    make: 'Mitsubishi',
    models: [
      {
        model: 'Triton',
        category: 'bakkie',
        engines: ['2.4', '2.5', '3.2'],
        cabTypes: ['single', 'double'],
      },
      {
        model: 'Pajero Sport',
        category: 'suv',
        engines: ['2.4', '3.2'],
      },
      {
        model: 'Pajero',
        category: 'suv',
        engines: ['3.2', '3.8'],
      },
      {
        model: 'ASX',
        category: 'suv',
        engines: ['2.0'],
      },
      {
        model: 'Outlander',
        category: 'suv',
        engines: ['2.0', '2.4', '3.0'],
      },
      {
        model: 'Eclipse Cross',
        category: 'suv',
        engines: ['1.5'],
      },
    ],
  },
  {
    make: 'Isuzu',
    models: [
      {
        model: 'D-Max',
        category: 'bakkie',
        engines: ['1.9', '2.5', '3.0'],
        cabTypes: ['single', 'extended', 'double'],
      },
      {
        model: 'MU-X',
        category: 'suv',
        engines: ['1.9', '3.0'],
      },
      {
        model: 'KB',
        category: 'bakkie',
        engines: ['2.5', '3.0'],
        cabTypes: ['single', 'extended', 'double'],
      },
    ],
  },
  {
    make: 'Honda',
    models: [
      {
        model: 'Brio',
        category: 'hatchback',
        engines: ['1.2'],
      },
      {
        model: 'Jazz',
        category: 'hatchback',
        engines: ['1.2', '1.5'],
      },
      {
        model: 'Amaze',
        category: 'sedan',
        engines: ['1.2'],
      },
      {
        model: 'Civic',
        category: 'sedan',
        engines: ['1.8', '2.0'],
      },
      {
        model: 'HR-V',
        category: 'suv',
        engines: ['1.5'],
      },
      {
        model: 'CR-V',
        category: 'suv',
        engines: ['2.0', '2.4'],
      },
    ],
  },
  {
    make: 'BMW',
    models: [
      { model: '1 Series', category: 'hatchback', engines: ['1.5', '2.0', '3.0'] },
      { model: '2 Series', category: 'coupe', engines: ['1.5', '2.0', '3.0'] },
      { model: '3 Series', category: 'sedan', engines: ['2.0', '3.0'] },
      { model: '4 Series', category: 'coupe', engines: ['2.0', '3.0'] },
      { model: '5 Series', category: 'sedan', engines: ['2.0', '3.0'] },
      { model: 'X1', category: 'suv', engines: ['1.5', '2.0'] },
      { model: 'X2', category: 'suv', engines: ['1.5', '2.0'] },
      { model: 'X3', category: 'suv', engines: ['2.0', '3.0'] },
      { model: 'X4', category: 'suv', engines: ['2.0', '3.0'] },
      { model: 'X5', category: 'suv', engines: ['3.0', '4.4'] },
      { model: 'X6', category: 'suv', engines: ['3.0', '4.4'] },
    ],
  },
  {
    make: 'Mercedes-Benz',
    aliases: ['Mercedes'],
    models: [
      { model: 'A-Class', category: 'hatchback', engines: ['1.3', '1.6', '2.0'] },
      { model: 'B-Class', category: 'mpv', engines: ['1.6', '2.0'] },
      { model: 'C-Class', category: 'sedan', engines: ['1.6', '2.0', '3.0'] },
      { model: 'E-Class', category: 'sedan', engines: ['2.0', '3.0'] },
      { model: 'CLA', category: 'sedan', engines: ['1.3', '2.0'] },
      { model: 'GLA', category: 'suv', engines: ['1.3', '2.0'] },
      { model: 'GLB', category: 'suv', engines: ['1.3', '2.0'] },
      { model: 'GLC', category: 'suv', engines: ['2.0'] },
      { model: 'GLE', category: 'suv', engines: ['3.0', '4.0'] },
      { model: 'V-Class', category: 'van', engines: ['2.0', '2.2'] },
      { model: 'Vito', category: 'van', engines: ['2.0', '2.2'] },
      { model: 'Sprinter', category: 'van', engines: ['2.1', '3.0'] },
    ],
  },
  {
    make: 'Audi',
    models: [
      { model: 'A1', category: 'hatchback', engines: ['1.0', '1.4', '2.0'] },
      { model: 'A3', category: 'hatchback', engines: ['1.0', '1.4', '2.0'] },
      { model: 'A4', category: 'sedan', engines: ['1.4', '2.0', '3.0'] },
      { model: 'A5', category: 'coupe', engines: ['2.0', '3.0'] },
      { model: 'A6', category: 'sedan', engines: ['2.0', '3.0'] },
      { model: 'Q2', category: 'suv', engines: ['1.0', '1.4', '2.0'] },
      { model: 'Q3', category: 'suv', engines: ['1.4', '2.0'] },
      { model: 'Q5', category: 'suv', engines: ['2.0', '3.0'] },
      { model: 'Q7', category: 'suv', engines: ['3.0'] },
    ],
  },
  {
    make: 'Land Rover',
    aliases: ['Range Rover'],
    models: [
      { model: 'Defender', category: 'suv', engines: ['2.0', '3.0'] },
      { model: 'Discovery', category: 'suv', engines: ['3.0'] },
      { model: 'Discovery Sport', category: 'suv', engines: ['2.0'] },
      { model: 'Range Rover Evoque', category: 'suv', engines: ['2.0'] },
      { model: 'Range Rover Velar', category: 'suv', engines: ['2.0', '3.0'] },
      { model: 'Range Rover Sport', category: 'suv', engines: ['3.0', '5.0'] },
    ],
  },
  {
    make: 'Jeep',
    models: [
      { model: 'Wrangler', category: 'suv', engines: ['2.0', '2.8', '3.6'] },
      { model: 'Grand Cherokee', category: 'suv', engines: ['3.0', '3.6', '5.7'] },
      { model: 'Compass', category: 'suv', engines: ['1.4', '2.0'] },
      { model: 'Renegade', category: 'suv', engines: ['1.4'] },
    ],
  },
  {
    make: 'Volvo',
    models: [
      { model: 'XC40', category: 'suv', engines: ['2.0', 'electric'] },
      { model: 'XC60', category: 'suv', engines: ['2.0'] },
      { model: 'XC90', category: 'suv', engines: ['2.0'] },
      { model: 'S60', category: 'sedan', engines: ['2.0'] },
      { model: 'V40', category: 'hatchback', engines: ['1.5', '2.0'] },
    ],
  },
  {
    make: 'Subaru',
    models: [
      { model: 'Forester', category: 'suv', engines: ['2.0', '2.5'] },
      { model: 'XV', aliases: ['Crosstrek'], category: 'suv', engines: ['2.0'] },
      { model: 'Outback', category: 'wagon', engines: ['2.5', '3.6'] },
      { model: 'Impreza', category: 'hatchback', engines: ['2.0'] },
      { model: 'WRX', category: 'sedan', engines: ['2.5', '2.4'] },
    ],
  },
  {
    make: 'Mahindra',
    models: [
      { model: 'Scorpio', category: 'suv', engines: ['2.2'] },
      { model: 'XUV300', category: 'suv', engines: ['1.2', '1.5'] },
      { model: 'XUV500', category: 'suv', engines: ['2.2'] },
      { model: 'XUV700', category: 'suv', engines: ['2.0', '2.2'] },
      {
        model: 'Pik Up',
        category: 'bakkie',
        engines: ['2.2'],
        cabTypes: ['single', 'double'],
      },
      { model: 'Thar', category: 'suv', engines: ['2.0', '2.2'] },
      { model: 'Bolero', category: 'suv', engines: ['1.5'] },
    ],
  },
  {
    make: 'GWM',
    aliases: ['Great Wall'],
    models: [
      {
        model: 'P-Series',
        category: 'bakkie',
        engines: ['2.0'],
        cabTypes: ['double'],
      },
      {
        model: 'Steed',
        category: 'bakkie',
        engines: ['2.0', '2.2'],
        cabTypes: ['double'],
      },
      { model: 'Tank 300', category: 'suv', engines: ['2.0'] },
    ],
  },
  {
    make: 'Haval',
    models: [
      { model: 'Jolion', category: 'suv', engines: ['1.5'] },
      { model: 'H2', category: 'suv', engines: ['1.5'] },
      { model: 'H6', category: 'suv', engines: ['1.5', '2.0'] },
      { model: 'H9', category: 'suv', engines: ['2.0'] },
    ],
  },
  {
    make: 'Chery',
    models: [
      { model: 'Tiggo 4 Pro', category: 'suv', engines: ['1.5'] },
      { model: 'Tiggo 7 Pro', category: 'suv', engines: ['1.6'] },
      { model: 'Tiggo 8 Pro', category: 'suv', engines: ['1.6', '2.0'] },
      { model: 'Omoda C5', category: 'suv', engines: ['1.5'] },
    ],
  },
  {
    make: 'JAC',
    models: [
      {
        model: 'T6',
        category: 'bakkie',
        engines: ['2.0'],
        cabTypes: ['double'],
      },
      {
        model: 'T8',
        category: 'bakkie',
        engines: ['2.0'],
        cabTypes: ['double'],
      },
      { model: 'X200', category: 'commercial', engines: ['2.0', '2.8'] },
    ],
  },
  {
    make: 'BAIC',
    models: [
      { model: 'D20', category: 'hatchback', engines: ['1.3', '1.5'] },
      { model: 'X25', category: 'suv', engines: ['1.5'] },
      { model: 'X35', category: 'suv', engines: ['1.5'] },
      { model: 'Beijing X55', category: 'suv', engines: ['1.5'] },
    ],
  },
  {
    make: 'Peugeot',
    models: [
      { model: '208', category: 'hatchback', engines: ['1.2', '1.6'] },
      { model: '2008', category: 'suv', engines: ['1.2', '1.6'] },
      { model: '3008', category: 'suv', engines: ['1.6', '2.0'] },
      { model: '5008', category: 'suv', engines: ['1.6'] },
      { model: '308', category: 'hatchback', engines: ['1.2', '1.6'] },
    ],
  },
  {
    make: 'Citroen',
    aliases: ['Citroën'],
    models: [
      { model: 'C3', category: 'hatchback', engines: ['1.2'] },
      { model: 'C3 Aircross', category: 'suv', engines: ['1.2'] },
      { model: 'C5 Aircross', category: 'suv', engines: ['1.6'] },
    ],
  },
  {
    make: 'Opel',
    models: [
      { model: 'Corsa', category: 'hatchback', engines: ['1.0', '1.2', '1.4'] },
      { model: 'Crossland', category: 'suv', engines: ['1.2'] },
      { model: 'Mokka', category: 'suv', engines: ['1.2'] },
      { model: 'Astra', category: 'hatchback', engines: ['1.4', '1.6'] },
    ],
  },
  {
    make: 'Fiat',
    models: [
      { model: '500', category: 'hatchback', engines: ['0.9', '1.2'] },
      { model: '500X', category: 'suv', engines: ['1.4'] },
      { model: 'Tipo', category: 'sedan', engines: ['1.4'] },
      { model: 'Panda', category: 'hatchback', engines: ['0.9', '1.2'] },
      { model: 'Doblo', category: 'van', engines: ['1.6'] },
    ],
  },
  {
    make: 'Alfa Romeo',
    aliases: ['Alfa'],
    models: [
      { model: 'Giulietta', category: 'hatchback', engines: ['1.4', '1.75'] },
      { model: 'Giulia', category: 'sedan', engines: ['2.0'] },
      { model: 'Stelvio', category: 'suv', engines: ['2.0'] },
      { model: 'MiTo', category: 'hatchback', engines: ['1.4'] },
    ],
  },
  {
    make: 'MINI',
    aliases: ['Mini'],
    models: [
      { model: 'Hatch', category: 'hatchback', engines: ['1.5', '2.0'] },
      { model: 'Clubman', category: 'wagon', engines: ['1.5', '2.0'] },
      { model: 'Countryman', category: 'suv', engines: ['1.5', '2.0'] },
    ],
  },
  {
    make: 'Jaguar',
    models: [
      { model: 'XE', category: 'sedan', engines: ['2.0', '3.0'] },
      { model: 'XF', category: 'sedan', engines: ['2.0', '3.0'] },
      { model: 'E-Pace', category: 'suv', engines: ['2.0'] },
      { model: 'F-Pace', category: 'suv', engines: ['2.0', '3.0'] },
    ],
  },
  {
    make: 'Lexus',
    models: [
      { model: 'UX', category: 'suv', engines: ['2.0'] },
      { model: 'NX', category: 'suv', engines: ['2.0', '2.5'] },
      { model: 'RX', category: 'suv', engines: ['3.5'] },
      { model: 'IS', category: 'sedan', engines: ['2.0', '2.5'] },
      { model: 'ES', category: 'sedan', engines: ['2.5'] },
    ],
  },
  {
    make: 'Porsche',
    models: [
      { model: 'Macan', category: 'suv', engines: ['2.0', '3.0'] },
      { model: 'Cayenne', category: 'suv', engines: ['3.0', '2.9', '4.8'] },
    ],
  },
  {
    make: 'Tesla',
    models: [
      { model: 'Model 3', category: 'sedan', engines: ['electric'] },
      { model: 'Model Y', category: 'suv', engines: ['electric'] },
    ],
  },
  {
    make: 'BYD',
    models: [
      { model: 'Atto 3', category: 'suv', engines: ['electric'] },
      { model: 'Dolphin', category: 'hatchback', engines: ['electric'] },
    ],
  },
  {
    make: 'ORA',
    models: [{ model: 'Ora Cat', category: 'hatchback', engines: ['electric'] }],
  },
  {
    make: 'SsangYong',
    aliases: ['Ssangyong'],
    models: [
      { model: 'Tivoli', category: 'suv', engines: ['1.6'] },
      { model: 'Korando', category: 'suv', engines: ['1.6', '2.0'] },
      { model: 'Rexton', category: 'suv', engines: ['2.2'] },
      {
        model: 'Musso',
        category: 'bakkie',
        engines: ['2.2'],
        cabTypes: ['double'],
      },
    ],
  },
  {
    make: 'MG',
    models: [
      { model: 'ZS', category: 'suv', engines: ['1.5', 'electric'] },
      { model: 'HS', category: 'suv', engines: ['1.5'] },
      { model: 'MG3', category: 'hatchback', engines: ['1.5'] },
      { model: 'MG4', category: 'hatchback', engines: ['electric'] },
    ],
  },
  {
    make: 'Datsun',
    models: [
      { model: 'GO', category: 'hatchback', engines: ['1.2'] },
      { model: 'GO+', category: 'mpv', engines: ['1.2'] },
    ],
  },
  {
    make: 'Chevrolet',
    models: [
      { model: 'Spark', category: 'hatchback', engines: ['1.2'] },
      { model: 'Utility', aliases: ['Corsa Utility'], category: 'bakkie', engines: ['1.4'] },
    ],
  },
  {
    make: 'Tata',
    models: [
      {
        model: 'Xenon',
        category: 'bakkie',
        engines: ['2.2'],
        cabTypes: ['single', 'double'],
      },
    ],
  },
]

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

export function getZaMakes(): string[] {
  return ZA_VEHICLE_TAXONOMY.map((entry) => entry.make)
}

export function getZaMake(make: string): ZaVehicleMake | undefined {
  const key = normalizeKey(make)
  return ZA_VEHICLE_TAXONOMY.find((entry) => {
    if (normalizeKey(entry.make) === key) return true
    return (entry.aliases || []).some((alias) => normalizeKey(alias) === key)
  })
}

export function getZaModel(make: string, model: string): ZaVehicleModel | undefined {
  const foundMake = getZaMake(make)
  if (!foundMake) return undefined
  const key = normalizeKey(model)
  return foundMake.models.find((entry) => {
    if (normalizeKey(entry.model) === key) return true
    return (entry.aliases || []).some((alias) => normalizeKey(alias) === key)
  })
}

export function getZaModelNames(make: string): string[] {
  const foundMake = getZaMake(make)
  if (!foundMake) return []
  return foundMake.models.map((entry) => entry.model)
}

export function getZaEngines(make: string, model: string): string[] {
  return getZaModel(make, model)?.engines || []
}

export function getZaCabTypes(make: string, model: string): CabType[] {
  return getZaModel(make, model)?.cabTypes || []
}

export function isZaBakkie(make: string, model: string): boolean {
  return getZaModel(make, model)?.category === 'bakkie'
}
