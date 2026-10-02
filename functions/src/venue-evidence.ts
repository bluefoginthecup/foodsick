import { db } from "./firebase.js";
import { fixtureFor, testVenue } from "./domain/test-fixtures.js";
import { chooseSafeRegion } from "./domain/public-signal.js";
// Registered fictional venues use the same publication pipeline as every other venue.
export async function registeredVenueEvidence(id:string,category:string) {
  const match=id.match(/^manual_test_([a-f0-9-]{36})_(v2_)?(\d{1,3})$/);
  if(!match)return undefined;
  const batch=await db.collection("testBatches").doc(match[1]!).get();
  if(!batch.exists)return null;
  if(match[2]){const fixture=fixtureFor(id,match[1]!);return fixture?.verified&&fixture.category===category?chooseSafeRegion(fixture.regions):null;}
  const fixture=testVenue(match[1]!,Number(match[3])%2);
  return chooseSafeRegion(fixture.regions.map(r=>({...r,sameCategoryVenueCount:6})));
}
