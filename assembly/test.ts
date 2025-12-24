import { JSON } from ".";
import { expect } from "./__tests__/lib";

expect(JSON.stringify(JSON.parse<string>(JSON.stringify("abcdYZ12345890sdfw\"vie91kfESDFOK12i9i12dsf./?")))).toBe('"abcdYZ12345890sdfw\\"vie91kfESDFOK12i9i12dsf./?"')