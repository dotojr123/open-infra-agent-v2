import { FileResult, WriteResult } from '../capabilities.types';

export interface FilesystemEngine {
  readFile(filePath: string): Promise<FileResult>;
  writeFile(filePath: string, dataBase64: string): Promise<WriteResult>;
}
