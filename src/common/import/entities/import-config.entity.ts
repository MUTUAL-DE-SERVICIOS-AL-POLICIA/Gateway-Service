import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Configuración de mapeo columna -> campo para una importación
 */
export interface ColumnMapping {
  /** Número de columna (1-indexed) en el archivo */
  columnIndex: number;
  /** Nombre del campo en el DTO de destino */
  fieldName: string;
}

/**
 * Configuración de importación para un tipo de archivo.
 * Define qué microservicio recibe los datos, en qué tabla se insertan,
 * cómo se mapean las columnas del archivo a los campos del DTO, etc.
 *
 * Cada registro es una configuración completa identificada por su `name`,
 * que se usa como identificador en la URL del endpoint de importación.
 *
 * Ejemplo de name: "extractos_bancarios", "planillas_apap"
 */
@Entity({ schema: 'global', name: 'import_configs' })
export class ImportConfig {
  @PrimaryGeneratedColumn('increment')
  id: number;

  /** Nombre único y legible para identificar esta configuración.
   * Se usa como identificador en el endpoint POST /import/:name */
  @Column({ unique: true, length: 100 })
  name: string;

  /** Nombre del microservicio NATS destino (ej: "collections") */
  @Column({ length: 50 })
  microservice: string;

  /** Schema de PostgreSQL donde está la tabla (ej: "collections", "public") */
  @Column({ length: 50 })
  schema: string;

  /** Nombre exacto de la tabla destino en PostgreSQL (ej: "bank_statements").
   * Debe coincidir con @Entity('...') en el microservicio destino. */
  @Column({ length: 50 })
  table: string;

  /** Cantidad de filas de encabezado a saltar al inicio del archivo */
  @Column({ default: 0 })
  skipRows: number;

  /** Columna donde empiezan los datos (1-indexed). Útil si la columna 1 está vacía */
  @Column({ default: 1 })
  startColumn: number;

  /** Mapeo de columnas del archivo a campos del DTO de destino */
  @Column({ type: 'jsonb', nullable: true })
  columnMappings: ColumnMapping[];

  /** Delimitador usado en archivos CSV (default: coma) */
  @Column({ length: 10, default: ',' })
  delimiter: string;

  /** Indica si esta configuración está activa */
  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
