# App token management

This document describes the improved active user interface and state management as well as the JWT expiry implementation from the front-end side.

## Background

- JWT access tokens provide access to API services
- these access tokens expire on a short interval, so as to minimise exposure in the case where traffic is intercepted
- a user can exchange a refresh token for a fresh access token
- refresh tokens eventually expire, though this expiry is a longer duration
- the app must manage automatically refreshing it's access token

## Tech stack

- this solution is built as a combination of passport + express + couch for managing the JWTs and refresh tokens, plus
- capacitor front end with react, redux and redux toolkit for managing and persisting the global auth state
- react integrations are preferenced where possible to tie in timer and loading gates into the react lifecycle

## Multi user configuration

- the App can be configured to connect with multiple servers (i.e. conductor + couch instances)
- the App handles locking into multiple users - i.e. a combination of a server + username
- there is an 'active user' which is a specified server and username combination

## Logged in/out

- if there is no active user, any logged in user will be chosen to be active
- if there are no logged in nor active users, then the user is considered logged out
- if the active user is present, but the token is expired, the user is considered to be logged out, but not completely - in this state the app will preference logging the active user back in by trying to refresh the token, or requesting with a login banner, a new login

## Refreshing

- refreshing is scheduled to occur on a regular timing interval
- a refresh is an API operation which trades the current refresh token for a new access token
- this then results in the new access token being stored in the persisted store
- flags such as `isAuthenticated` will be refreshed so that granular redux selectors can force re-renders of protected parts of the app

## Refreshing while offline

- if the app goes offline, the local pouch will continue to function as per usual and sync will attempt to be renewed when online connection is available again
- if the refresh fails, nothing special will occur
- when the network returns, an event is triggered which specifically dispatches a token refresh event to try and minimise the risk of a stale token during patchy network conditions
- in persistent offline conditions, this could result in the isAuthenticated flag becoming false once the active token becomes expired
- this is why the app distinguishes between no active user and `isAuthenticated = false`, vs active user and `isAuthenticated = false`

## The main protected route component

- the protected route component checks if the isAuthenticated flag is true. If so - it renders the component, otherwise it returns the login page
- this isAuthenticated flag only prompts a re-render due to the granular selector when the boolean value changes
- the issue is that if the user is offline or online, eventually the token will expire (which could be in a few minutes for short lived access tokens) - we don't want to boot the user out of offline access by forcing them to try to log back in - instead we use the below component and show a banner

## Classes of protected route

- some routes should never be shown when the token is expired because their purpose/function would be impossible to fulfil - an example of this could be the create new survey page
- some routes should be shown as long as there is at least an active user who has a token (be it possibly invalid) - an example of this would be during responding to a survey

In the second class, we could show a banner in the condition where `isAuthenticated` is false to indicate that the user could login - this banner would show a link to the login page if the user is online. If you are offline, no banner is shown since there is no action the user can take to remedy the situation.

## Improvements later

- (later) don't bother attempting to refresh when offline OR when the refresh token has expired
- (later) on app open - always go to login screen when refresh token expired or close to
- (later) per server per user db?
- (later) alert when token was expired but logged back in successfully
