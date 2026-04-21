/** @jest-environment node */

jest.mock('@/lib/auth/db', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/lib/auth/password', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
}));

jest.mock('@/lib/auth/session', () => ({
  attachSessionCookie: jest.fn(),
}));

jest.mock('@/lib/auth/student-model', () => ({
  StudentModel: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

import { connectToDatabase } from '@/lib/auth/db';
import { DEMO_USER } from '@/lib/auth/demo-user';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { attachSessionCookie } from '@/lib/auth/session';
import { StudentModel } from '@/lib/auth/student-model';

describe('auth login route', () => {
  const mockedConnectToDatabase = connectToDatabase as jest.MockedFunction<typeof connectToDatabase>;
  const mockedHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>;
  const mockedVerifyPassword = verifyPassword as jest.MockedFunction<typeof verifyPassword>;
  const mockedAttachSessionCookie = attachSessionCookie as jest.MockedFunction<typeof attachSessionCookie>;

  const mockedStudentModel = StudentModel as unknown as {
    findOne: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    mockedConnectToDatabase.mockResolvedValue(undefined as never);
  });

  async function callRoute(payload: unknown, options?: { malformedJson?: boolean }) {
    const { POST } = await import('../app/api/auth/login/route');

    const request = options?.malformedJson
      ? ({
          json: async () => {
            throw new Error('Invalid JSON payload');
          },
        } as Request)
      : ({
          json: async () => payload,
        } as Request);

    return POST(request);
  }

  it('logs in a regular student with register number and password', async () => {
    const student = {
      _id: {
        toString: () => 'student-id-regular',
      },
      registerNumber: '24UCS046',
      email: 'regular.student@example.com',
      fullName: 'Regular Student',
      passwordHash: 'stored-hash',
      googleSub: '',
    };

    mockedStudentModel.findOne.mockResolvedValue(student);
    mockedVerifyPassword.mockResolvedValue(true);
    mockedAttachSessionCookie.mockResolvedValue(undefined);

    const response = await callRoute({
      registerNumber: ' 24ucs046 ',
      password: 'Pass1234',
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.user).toEqual({
      id: 'student-id-regular',
      registerNumber: '24UCS046',
      email: 'regular.student@example.com',
      fullName: 'Regular Student',
      hasGoogleLinked: false,
    });

    expect(mockedStudentModel.findOne).toHaveBeenCalledWith({ registerNumber: '24UCS046' });
    expect(mockedVerifyPassword).toHaveBeenCalledWith('Pass1234', 'stored-hash');
    expect(mockedAttachSessionCookie).toHaveBeenCalledTimes(1);
    expect(mockedAttachSessionCookie.mock.calls[0][1]).toEqual({
      id: 'student-id-regular',
      registerNumber: '24UCS046',
      email: 'regular.student@example.com',
      fullName: 'Regular Student',
    });
  });

  it('provisions and logs in the demo account in non-production environments', async () => {
    process.env.NODE_ENV = 'development';

    mockedHashPassword.mockResolvedValue('demo-hash');
    mockedStudentModel.findOne.mockResolvedValueOnce(null);

    const createdDemoStudent = {
      _id: {
        toString: () => 'student-id-demo',
      },
      registerNumber: DEMO_USER.registerNumber,
      email: DEMO_USER.email,
      fullName: DEMO_USER.fullName,
      passwordHash: 'demo-hash',
      googleSub: '',
    };

    mockedStudentModel.create.mockResolvedValue(createdDemoStudent);
    mockedAttachSessionCookie.mockResolvedValue(undefined);

    const response = await callRoute({
      registerNumber: DEMO_USER.registerNumber,
      password: DEMO_USER.password,
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.user).toEqual({
      id: 'student-id-demo',
      registerNumber: DEMO_USER.registerNumber,
      email: DEMO_USER.email,
      fullName: DEMO_USER.fullName,
      hasGoogleLinked: false,
    });

    expect(mockedHashPassword).toHaveBeenCalledWith(DEMO_USER.password);
    expect(mockedStudentModel.create).toHaveBeenCalledTimes(1);
    expect(mockedVerifyPassword).not.toHaveBeenCalled();
    expect(mockedAttachSessionCookie).toHaveBeenCalledTimes(1);
  });

  it('does not enable demo auto-provisioning in production', async () => {
    process.env.NODE_ENV = 'production';

    mockedStudentModel.findOne.mockResolvedValue(null);

    const response = await callRoute({
      registerNumber: DEMO_USER.registerNumber,
      password: DEMO_USER.password,
    });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('INVALID_CREDENTIALS');
    expect(mockedHashPassword).not.toHaveBeenCalled();
    expect(mockedStudentModel.create).not.toHaveBeenCalled();
  });

  it('returns invalid request for malformed JSON payload', async () => {
    const response = await callRoute({}, { malformedJson: true });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('INVALID_REQUEST');
  });
});
