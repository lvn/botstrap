# Project Solaria

> "My mind-store of information includes the fact that, of the fifty Outer Worlds, Solaria is by far the best known for the variety and excellence of robot models it turns out."

-- R. Daneel Olivaw, *The Naked Sun*

Project **Solaria** is an effort to rebuild, from the ground up, how a bot handles messages in Botstrap.

### Goals
#### Main
* Support stateful chat exchanges.
* Integrate, abstract and unify the Slack real-time messaging and web APIs.
* Build better logging into the bot itself - do not rely on modules logging.

#### Secondary
* Fault tolerance/isolation - isolate errors to the module that originated it.
*


### Concepts
#### Conversations
The core concept of this design is the *Conversation*. Intuitively, a Conversation is an object that represents a conversation between a user (or maybe more than one) and the bot. The design is influenced by Erlang-style processes.

Most importantly, a conversation is *stateful* - it can change its state based on a number of different events (primarily, a user talking), which will allow the bot to express more intelligent, dynamic bot behavior. The lifecycle management should flexibly support a number of different flows.

More precisely, the *state* of a conversation is the data concerning what the bot should say, and how the conversation can proceed. States are associated primarily with a *state type*, identified with a symbol. The intention is for conversations to have a small number of separate state types. For example, a module for searching videos might have a "querying" state, and a "displaying result" state.

In this capacity, the *module* is essentially a prototype that provides a state machine for the Conversation to take on.

`Conversation` should be able to support old-style plugin calls, which are equivalent to a Conversation that finishes after one request-reply exchange.

#### Injectable
One of the features of Botstrap is a dependency injection interface for callbacks. It allowed for rapid prototyping and iteration, and that is not going away in the redesign.

Primarily, two types of objects get injected into a callback:
* **services**, which allows some functionality with the same configurations to be exposed to any conversation. Example: a database client.
* **resources**, which are static (read-only) objects maintained by the bot over time. Example: a list of channels.

### Basic Flow
On the bot side:
* The bot starts up, and connects to the Slack RTM API. It also maintains a client to the web API.
* The bot listens, through an *ingester*, to every message on the channels that it is in, as well as a few other events.
  * Potentially, we can optimize the number of listened events based on the loaded plugins, but this is an unnecessary optimization for now.
* A subscribed event passes through a *router*, which contains logic on how to dispatch the event. Primarily, it will either create a new `Conversation`, or route it to an existing Conversation.
  * Conversations will have some sort of pre-set "finished" or "terminate" state (before they get GC'd) that it can transition to; the Router should not try to send messages to terminated conversations.
  * Open question: Where does the routing logic live? Since different states of a conversation can listen to different events, we cannot just register once at load.
  * The actual routing logic is stored as a series of *rules*, which are structures that contain a *classifier*, the conversation, expected state type, and some other metadata to match against the event.
    * The classifier is a developer-defined predicate function that determines whether this rule applies to the current event.
    * The router will also check if the conversation is currently at a state that has the expected state type. If it doesn't, it removes it from the
    * When dispatching an event, the router tries to evaluate the rule against the event, and stops *only* when there is a match. At that point, it sends that event to the conversation.
  * The dispatcher will also dispatch these events to some *secondary* consumers. For example, a logging service might want to consume these events and store them in a database.

On the conversation side:
* The Conversation starts up. It calls the *main* callback exported by the module. (i.e. the actual `module.exports` object in the old style modules) Importantly, it injects the `state` object to it, which lets it transition states. The conversations starts in some sort of "start" state.
* If the Conversation remains in the start state at the end of the main callback, i.e. it does not have a reducer or does not transition to another, the conversation is terminated at the end of it.
  * This does *not* mean that the conversation becomes disabled/deleted. Outstanding async callbacks are still allowed to operated on the injected services/resources.
  * Open question: When should the Conversation be marked as terminated? We should allow asynchronous state transitions, so we cannot mark it synchronously. (Potentially, do this asynchronously using `setTimeout(..., 0)`)
* Otherwise, the conversation is now in another state, and as new events get routed to it, it can behave/respond/transition/etc. accordingly.
* Eventually, the conversation is terminated, probably by explicitly transitioning into a "stopped" state.

### Implementation Plan
* **Stage 1:** Implement `Conversation` objects as a container for module callbacks. Implement a basic `Router` that lets modules *explicitly* opt-in to the new dispatch flow.
  * The bot no longer directly interacts with the module callbacks. Instead, everything is done through `Conversation` lifecycle management.
  * The router has to explicitly support the old flow, i.e. modules directly subscribing to events.
* **Stage 2:** Implement a proper ingester and router.
  * Reimplement the `Bot#on` method to subscribe to the router instead of  
* **Stage 3:** Let modules manage their own state.
  * Expose a `State` service to be injectable to Conversations.
