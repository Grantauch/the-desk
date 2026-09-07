import { ClassroomProviderError, type ClassroomProvider } from './types.js';

export class DisabledClassroomProvider implements ClassroomProvider {
  async beginAuthorization(): Promise<never> {
    throw new ClassroomProviderError('EXTERNAL_PROVIDER_ERROR', 'Google Classroom connection is not configured.', false);
  }
  async completeAuthorization(): Promise<never> {
    throw new ClassroomProviderError('EXTERNAL_PROVIDER_ERROR', 'Google Classroom connection is not configured.', false);
  }
  async listCourses(): Promise<never> {
    throw new ClassroomProviderError('EXTERNAL_PROVIDER_ERROR', 'Google Classroom connection is not configured.', false);
  }
  async listStudents(): Promise<never> {
    throw new ClassroomProviderError('EXTERNAL_PROVIDER_ERROR', 'Google Classroom connection is not configured.', false);
  }
  async listTeachers(): Promise<never> {
    throw new ClassroomProviderError('EXTERNAL_PROVIDER_ERROR', 'Google Classroom connection is not configured.', false);
  }
}
