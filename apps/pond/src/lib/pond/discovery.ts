export const STARTERS = ["Water", "Fire", "Earth", "Wind"] as const;
const recipes: Record<string,string> = {
  "Earth|Water":"Mud","Fire|Water":"Steam","Fire|Wind":"Energy","Earth|Wind":"Dust",
  "Steam|Wind":"Cloud","Cloud|Water":"Rain","Earth|Rain":"Plant","Mud|Plant":"Swamp",
  "Fire|Plant":"Ash","Plant|Water":"Garden","Garden|Water":"Forest","Forest|Wind":"Leaves",
  "Earth|Fire":"Lava","Lava|Water":"Stone","Stone|Wind":"Sand","Sand|Water":"Beach",
  "Beach|Water":"Ocean","Ocean|Wind":"Wave","Cloud|Energy":"Storm","Rain|Storm":"Lightning",
  "Energy|Stone":"Metal","Metal|Stone":"Tool","Tool|Wood":"Machine","Forest|Tool":"Wood",
  "Fire|Wood":"Campfire","Campfire|Water":"Soup","Ocean|Plant":"Algae","Algae|Water":"Life",
  "Earth|Life":"Animal","Animal|Water":"Fish","Animal|Wind":"Bird","Bird|Ocean":"Seagull",
  "Fish|Ocean":"Reef","Life|Stone":"Fossil","Energy|Life":"Spirit","Spirit|Forest":"Fairy",
  "Machine|Water":"Pump","Machine|Wind":"Windmill","Energy|Machine":"Robot",
  "Robot|Life":"Android","Cloud|Stone":"Mountain","Mountain|Water":"River",
  "River|Plant":"Valley","Fire|Sand":"Glass","Glass|Water":"Aquarium",
  "Aquarium|Fish":"Fish Tank","Garden|Life":"Butterfly","Butterfly|Wind":"Migration",
};
export function combine(a:string,b:string):string | null {
  const key=[a,b].sort().join("|");
  return recipes[key] ?? null;
}
export const RECIPE_COUNT=Object.keys(recipes).length;
