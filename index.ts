class SrvInfo {
  accessUrl: string = "https://example.com";
  cardTypes: number[] = [1, 2, 3];
  customService: string = "Contact us at support@example.com";
  invoiceApplicationStatus: number = 1;
  isCertification: bool = true;
  isOnlineRecharge: bool = false;
  loginTypes: number[] = [0, 1]; // e.g. 0 = password, 1 = OTP
  record: string = "ICP 12345678";
  regCompanyAudit: number = 2;
  regCompanyPipeline: number[] = [101, 102, 103];
  regPwdLimit: number = 8; // min password length
  serverTime: i64 = 1650000000000; // dummy timestamp
  srvDescription: string = "A demo service for handling customer operations.";
  srvHiddenMenu: string[] = ["admin", "beta"];
  srvHost: string = "srv.example.com";
  srvId: number = 999;
  srvKeywords: string[] = ["finance", "payments", "online"];
  srvLogoImgUrl: string = "https://example.com/logo.png";
  srvName: string = "ExampleService";
  srvPageId: number = 5;
  thirdAuthUrl: string = "https://auth.example.com";
  userCenterStyle: number = 1; // e.g. 1 = modern, 0 = legacy
}

console.log(JSON.stringify(new SrvInfo()))