import { generalModule } from "./general";
import { lntModule } from "./lnt";

export const trainingModules = [lntModule, generalModule] as const;

export function getTrainingModule(slug: string) {
  return trainingModules.find((module) => module.slug === slug);
}
