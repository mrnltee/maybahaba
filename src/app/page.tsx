import { HomeClient } from "@/components/HomeClient";
import { isUsingMockData } from "@/lib/services/reports";

export default function HomePage() {
  return <HomeClient isUsingMockData={isUsingMockData} />;
}
