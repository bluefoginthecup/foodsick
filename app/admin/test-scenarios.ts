import { testVenue } from "../../functions/src/domain/test-fixtures.ts";
import type { ReportDraft } from "../contracts";

// Stable dates and restaurant IDs make reruns exercise duplicate prevention.
export function testScenario(batchId: string, date: string, index: number): ReportDraft {
  const group = index < 30 ? Math.floor(index / 3) : index;
  const companion = index >= 70 && index < 90;
  return {
    mealDate: date, mealTime: `12:${String(index % 60).padStart(2, "0")}`,
    province: "경기도", city: "용인시", district: "기흥구 영덕동",
    restaurantInternalId: `manual_test_${batchId}_${group}`,
    restaurantDisplayInput: `가상 시험 음식점 ${group + 1}`, foodCategory: index < 30 ? "냉면" : (["한식", "중식", "분식", "일식"] as const)[index % 4],
    foodCategoryDetail: "", menu: `가상 메뉴 ${index + 1}`, serviceMode: (["dine_in", "delivery", "takeout"] as const)[index % 3],
    symptoms: index % 2 ? ["설사", "복통"] : ["구토", "발열"], diarrheaCount: index % 2 ? index % 5 + 1 : 0,
    otherSymptom: "", onsetDate: date, onsetTime: `18:${String(index % 60).padStart(2, "0")}`,
    partyTotal: companion ? 3 : 1, partySymptomatic: companion ? 1 : 0,
    companions: companion ? [{ age: 20 + index % 50, gender: "undisclosed", symptoms: ["복통"], otherSymptom: "", onsetAt: `${date}T19:00`, medicalVisit: index % 2 === 0, tested: false, underlyingConditions: ["없음"], otherUnderlyingCondition: "" }] : [],
    companionSymptoms: companion ? ["복통"] : [], companionOnsetAt: companion ? `${date}T19:00` : "", companionMedicalVisit: companion && index % 2 === 0, companionTested: false,
    medicalVisit: index % 3 === 0, hospitalized: index % 15 === 0, tested: index % 6 === 0, pathogenKnown: false, pathogenType: "",
  };
}

export function realisticTestScenario(batchId: string, date: string, index: number): ReportDraft {
  const group = index < 30 ? Math.floor(index/3) : index < 50 ? 10+Math.floor((index-30)/2) : index < 70 ? 20+Math.floor((index-50)/5) : index;
  const venue = testVenue(batchId,group);
  const mealDate = new Date(Date.parse(`${date}T12:00:00+09:00`) - (group%30)*86400000).toISOString().slice(0,10);
  const base = testScenario(batchId,mealDate,index);
  const companions: ReportDraft["companions"] = index>=50 && index<70 ? [{age:30,gender:"undisclosed" as const,symptoms:["복통"],otherSymptom:"",onsetAt:`${mealDate}T21:00`,medicalVisit:index%2===0,tested:false,underlyingConditions:["없음"],otherUnderlyingCondition:""}] : base.companions;
  return {...base,province:venue.sido,city:venue.city,district:venue.district===venue.city ? venue.dong : `${venue.district} ${venue.dong}`,
    restaurantInternalId:venue.id,restaurantDisplayInput:venue.name,foodCategory:venue.category,menu:venue.menu,publicMenus:[venue.menu],
    mealTime:`12:${String(index%60).padStart(2,"0")}`,onsetTime:`${index%2 ? "18" : "22"}:00`,
    companions,partySymptomatic:companions.length,partyTotal:companions.length ? 3 : 1,
    companionSymptoms:companions.length ? ["복통"] : [],companionOnsetAt:companions.length ? `${mealDate}T21:00` : "",
  };
}
