import { HealthLog } from './healthLog';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainStackParamList = {
  HealthLogList: undefined;
  HealthLogDetail: {
    healthLog: HealthLog;
  };
  HealthLogForm: {
    mode: 'create' | 'edit';
    healthLog?: HealthLog;
  };
};