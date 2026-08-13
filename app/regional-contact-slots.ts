import type { ContactKind, RegionSelection, RegionalContact } from "./regional-contacts";

export type RegionalContactSlot = {
  kind: ContactKind;
  label: string;
  expectedName: string;
  contact: RegionalContact | null;
};

function isMetropolitanDistrict(selection: RegionSelection) {
  return /(?:특별시|광역시)$/.test(selection.sido) && Boolean(selection.district);
}

export function expectedRegionalContactSlots(selection: RegionSelection, contacts: RegionalContact[]): RegionalContactSlot[] {
  const cityOfficeName = /(?:특별시|광역시|특별자치시)$/.test(selection.sido)
    ? `${selection.sido}청`
    : `${selection.city}청`;
  const districtOfficeName = `${selection.district}청`;
  const localArea = selection.district || selection.city;
  const definitions: Array<Omit<RegionalContactSlot, "contact">> = [
    { kind: "city_office", label: "관할 시청", expectedName: cityOfficeName },
  ];
  if (selection.district && (selection.district !== selection.city || isMetropolitanDistrict(selection))) {
    definitions.push({ kind: "district_office", label: "관할 구청·군청", expectedName: districtOfficeName });
  }
  definitions.push(
    { kind: "health_center", label: "관할 보건소", expectedName: `${localArea} 보건소` },
    { kind: "food_safety", label: "식품위생 담당", expectedName: `${localArea} 식품위생 담당부서` },
  );
  return definitions.map((definition) => ({
    ...definition,
    contact: contacts.find((contact) => contact.kind === definition.kind) ?? null,
  }));
}
