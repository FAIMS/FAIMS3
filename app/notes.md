# Token refresh logic

## Refreshing

- refreshing is scheduled to occur on a regular timing interval
- a refresh is an API operation which trades the current refresh token for a new access token
- this then results in the new access token being stored in the persisted store - flags such as isAuthenticated will be refreshed but result in no change so as not to trigger a re-render for protected route components unnecessarily

## Refreshing while offline

- if the app goes offline, the local pouch will continue to function as per usual and sync will attempt to be renewed when online connection is available again
- if the refresh fails, nothing special will occur
- when the network returns, an event is triggered which specifically dispatches a token refresh event to try and minimise the risk of a stale token during patchy network conditions
- in persistent offline conditions, this could result in the isAuthenticated flag becoming false once the active token becomes expired

## The main protected route component

- the protected route component checks if the isAuthenticated flag is true. If so - it renders the component, otherwise it returns the login page
- this isAuthenticated flag only prompts a re-render due to the granular selector when the boolean value changes 
- the issue is that if the user is offline, eventually the token will expire (which could be in a few minutes for short lived access tokens) - we don't want to boot the user out of offline access by forcing them to try to log back in

## Classes of protected route

- some routes should never be shown when the token is expired because their purpose/function would be impossible to fulfil - an example of this could be the create new survey page
- some routes should be shown as long as there is at least an active user who has a token (be it possibly invalid) - an example of this would be during responding to a survey

In the second class, we could show a banner in the condition where isAuthenticated is false to indicate that the user could login - this banner would show a link to the login page if the user is online - otherwise it would indicate you are offline so the device will just wait until you are online. 

## TODO

- update the couch configuration token when the token is changed - who's token do I use in the case where there is multiple users?
    - need Steve's help
    - find the trigger which is most suitable to update the token in the couch DB
- alert when token was expired but logged back in successfully
- redesign 
- you can't login while offline
- button in top right needs to show profile (maybe with exclamation) when logged in but expired
- change 'Welcome' - if active user show 'log back in to' etc. - get rid of enter access code under this condition 
- add logout button onto popup
- (later) - make the refresh token expiry be taken into account
- (later) - on app open - always go to login screen when refresh token expired or close to
- (later) per server per user db? 