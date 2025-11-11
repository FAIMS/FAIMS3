export type NotVisibleBehaviour = 'ignore' | 'include';
export type ValidationSettings = {
  // Do you want to only validate a specific section?
  targetSectionId? : string;
  // Behaviour for handling data which is provided but which is not visible due to conditional logic 

}
export type ValidationResult = {
  valid: boolean;
};
