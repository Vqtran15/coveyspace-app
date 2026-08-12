// Module-level ref so any component can reach the SW registration
// without prop-drilling. Set once by UpdatePrompt on registration.
export const swRegistrationRef = { current: null }
