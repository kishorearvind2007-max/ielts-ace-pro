/** @jest-environment node */

jest.mock('@/lib/auth/db', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/lib/auth/password', () => ({
  hashPassword: jest.fn(),
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
import { hashPassword } from '@/lib/auth/password';
import { attachSessionCookie } from '@/lib/auth/session';
import { StudentModel } from '@/lib/auth/student-model';

function mockLeanQuery<T>(value: T) {
  return {
    lean: jest.fn().mockResolvedValue(value),
  };
}

describe('auth register route', () => {
  const mockedConnectToDatabase = connectToDatabase as jest.MockedFunction<typeof connectToDatabase>;
  const mockedHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>;
  const mockedAttachSessionCookie = attachSessionCookie as jest.MockedFunction<typeof attachSessionCookie>;
  const mockedStudentModel = StudentModel as unknown as {
    findOne: jest.Mock;
    create: jest.Mock;
  };

  const validPayload = {
    fullName: '  Deepesh  ',
    registerNumber: ' 24ucs046 ',
    email: 'DEEPESHCDM@gmail.com',
    password: 'Pass1234',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  async function callRoute(payload: unknown, options?: { malformedJson?: boolean }) {
    const { POST } = await import('../app/api/auth/register/route');

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

  it('creates a new student account and attaches a session cookie', async () => {
    mockedConnectToDatabase.mockResolvedValue(undefined as never);
    mockedStudentModel.findOne
      .mockReturnValueOnce(mockLeanQuery(null))
      .mockReturnValueOnce(mockLeanQuery(null));
    mockedHashPassword.mockResolvedValue('hashed-password');

    const createdStudent = {
      _id: {
        toString: () => 'student-id-1',
      },
      registerNumber: '24UCS046',
      email: 'deepeshcdm@gmail.com',
      fullName: 'Deepesh',
      googleSub: '',
    };

    mockedStudentModel.create.mockResolvedValue(createdStudent);
    mockedAttachSessionCookie.mockResolvedValue(undefined);

    const response = await callRoute(validPayload);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.user).toEqual({
      id: 'student-id-1',
      registerNumber: '24UCS046',
      email: 'deepeshcdm@gmail.com',
      fullName: 'Deepesh',
      hasGoogleLinked: false,
    });

    expect(mockedStudentModel.create).toHaveBeenCalledWith({
      fullName: 'Deepesh',
      registerNumber: '24UCS046',
      email: 'deepeshcdm@gmail.com',
      passwordHash: 'hashed-password',
    });

    expect(mockedAttachSessionCookie).toHaveBeenCalledTimes(1);
    expect(mockedAttachSessionCookie.mock.calls[0][1]).toEqual({
      id: 'student-id-1',
      registerNumber: '24UCS046',
      email: 'deepeshcdm@gmail.com',
      fullName: 'Deepesh',
    });
  });

  it('returns conflict when register number already exists', async () => {
    mockedConnectToDatabase.mockResolvedValue(undefined as never);
    mockedStudentModel.findOne
      .mockReturnValueOnce(mockLeanQuery({ _id: 'existing-register' }))
      .mockReturnValueOnce(mockLeanQuery(null));

    const response = await callRoute(validPayload);
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toBe('CONFLICT');
    expect(json.message).toBe('Register number already exists.');
    expect(mockedStudentModel.create).not.toHaveBeenCalled();
  });

  it('returns conflict when duplicate key race happens at create time', async () => {
    mockedConnectToDatabase.mockResolvedValue(undefined as never);
    mockedStudentModel.findOne
      .mockReturnValueOnce(mockLeanQuery(null))
      .mockReturnValueOnce(mockLeanQuery(null));
    mockedHashPassword.mockResolvedValue('hashed-password');
    mockedStudentModel.create.mockRejectedValue({
      code: 11000,
      keyPattern: { email: 1 },
    });

    const response = await callRoute(validPayload);
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toBe('CONFLICT');
    expect(json.message).toBe('Email already exists.');
  });

  it('returns helpful server error when infrastructure config is invalid', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedConnectToDatabase.mockRejectedValue(
      new Error('Invalid MONGODB_URI in environment variables. Replace placeholder values with real credentials.'),
    );

    const response = await callRoute(validPayload);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('SERVER_ERROR');
    expect(json.message).toBe('Registration is unavailable due to server configuration.');
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
  });

  it('returns invalid request for malformed JSON body', async () => {
    const response = await callRoute(validPayload, { malformedJson: true });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('INVALID_REQUEST');
    expect(json.message).toBe('Invalid JSON payload.');
  });
});
