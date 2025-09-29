import { JSON } from ".";
import { expect, it } from "./__tests__/lib";

it("should deserialize a default empty array", () => {
  const data =
    '{"certificationGroups":[{"certGroupID":"0x653aae","title":"Food Safety"}]}';

  const obj = JSON.parse<CertificationGroupResponse>(data);

  expect(obj.certificationGroups.length).toBe(1);
  expect(obj.certificationGroups[0].certGroupID).toBe("0x653aae");
  expect(obj.certificationGroups[0].title).toBe("Food Safety");
  expect(obj.certificationGroups[0].certifications.length).toBe(0);
});

@json
class Certification {
  certID: string = "";
  title: string = "";
  abbr: string = "";
}

@json
class CertificationGroup {
  certGroupID!: string;
  title!: string;
  certifications!: Certification[];
}

@json
class CertificationGroupResponse {
  certificationGroups!: CertificationGroup[];
}