import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Estados posibles de una importación
 */
export enum ImportStatus {
  /** Pendiente de procesar */
  PENDING = 'PENDING',
  /** Procesando lotes */
  PROCESSING = 'PROCESSING',
  /** Importación completada exitosamente */
  COMPLETED = 'COMPLETED',
  /** Importación fallida */
  FAILED = 'FAILED',
}

/**
 * Entidad que registra cada archivo importado.
 * Almacena la referencia al archivo en FTP, quién lo cargó, cuándo,
 * y el estado del proceso de importación.
 */
@Entity({ schema: 'global', name: 'import_records' })
export class ImportRecord {
  @PrimaryGeneratedColumn('increment')
  id: number;

  /** Nombre de la config de importación usada (ej: "extractos_bancarios") */
  @Column({ length: 100 })
  target: string;

  /** Ruta completa del archivo en el servidor FTP */
  @Column({ length: 500, name: 'ftp_path' })
  ftpPath: string;

  /** Hash SHA256 del archivo para detectar importaciones duplicadas */
  @Column({ length: 64, nullable: true, name: 'file_hash' })
  fileHash: string;

  /** Nombre original del archivo subido */
  @Column({ length: 255, name: 'original_file_name' })
  originalFileName: string;

  /** Usuario que realizó la importación */
  @Column({ length: 100, nullable: true, name: 'uploaded_by' })
  uploadedBy: string;

  /** Estado actual de la importación */
  @Column({
    type: 'enum',
    enum: ImportStatus,
    default: ImportStatus.PENDING,
  })
  status: ImportStatus;

  /** Total de filas encontradas en el archivo */
  @Column({ default: 0, name: 'total_rows' })
  totalRows: number;

  /** Total de filas procesadas exitosamente */
  @Column({ default: 0, name: 'processed_rows' })
  processedRows: number;

  /** Número de fila inicial en la tabla destino que corresponde a esta importación */
  @Column({ default: 0, name: 'row_start' })
  rowStart: number;

  /** Número de fila final en la tabla destino que corresponde a esta importación */
  @Column({ default: 0, name: 'row_end' })
  rowEnd: number;

  /** Mensaje de error si la importación falló */
  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
