import type { Metadata } from "next";
import { ResourceDirectory } from "./resource-directory";

export const metadata: Metadata = {
  title: "논문·참고자료 | 나두아파",
  description: "시민 참여 연구부터 공식 식중독 통계와 예방 안내까지, 유형별로 살펴보는 나두아파 자료실",
};

export default function ResourcesPage() {
  return <main><ResourceDirectory /></main>;
}
