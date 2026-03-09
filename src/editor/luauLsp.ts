import type * as Monaco from 'monaco-editor';
import { LUAU_LANGUAGE_ID } from './luauLanguage';

interface FunctionSignature {
  label: string;
  documentation: string;
  parameters: { label: string; documentation: string }[];
}

interface HoverInfo {
  label: string;
  documentation: string;
  signature?: string;
}

const HOVER_DATA: Record<string, HoverInfo> = {
  print: { label: 'print', documentation: 'Outputs values to the console.', signature: 'print(...any)' },
  warn: { label: 'warn', documentation: 'Outputs a warning message to the console with yellow color.', signature: 'warn(...any)' },
  error: { label: 'error', documentation: 'Raises an error with the given message. Level 0 returns no stack, 1 (default) is current function.', signature: 'error(message: string, level?: number)' },
  assert: { label: 'assert', documentation: 'Raises an error if the condition is false or nil.', signature: 'assert(condition: any, message?: string): any' },
  type: { label: 'type', documentation: 'Returns the Lua type as a string: "nil", "number", "string", "boolean", "table", "function", "thread", or "userdata".', signature: 'type(value: any): string' },
  typeof: { label: 'typeof', documentation: 'Returns the Roblox type as a string, including custom types like "Instance", "Vector3", etc.', signature: 'typeof(value: any): string' },
  tostring: { label: 'tostring', documentation: 'Converts the value to a string representation.', signature: 'tostring(value: any): string' },
  tonumber: { label: 'tonumber', documentation: 'Converts a value to a number. Returns nil if conversion fails.', signature: 'tonumber(value: any, base?: number): number?' },
  pairs: { label: 'pairs', documentation: 'Returns an iterator for all key-value pairs in a table.', signature: 'pairs(t: table): iterator' },
  ipairs: { label: 'ipairs', documentation: 'Returns an iterator for array indices 1 to n in order.', signature: 'ipairs(t: table): iterator' },
  next: { label: 'next', documentation: 'Returns the next key-value pair after the given key.', signature: 'next(t: table, key?: any): (any, any)' },
  select: { label: 'select', documentation: 'Returns arguments from index, or count with "#".', signature: 'select(index: number | "#", ...): any' },
  unpack: { label: 'unpack', documentation: 'Returns elements from a table as separate values.', signature: 'unpack(t: table, i?: number, j?: number): ...any' },
  pcall: { label: 'pcall', documentation: 'Calls function in protected mode. Returns success boolean and results or error.', signature: 'pcall(f: function, ...args): (boolean, ...any)' },
  xpcall: { label: 'xpcall', documentation: 'Like pcall but with custom error handler function.', signature: 'xpcall(f: function, err: function, ...args): (boolean, ...any)' },
  require: { label: 'require', documentation: 'Loads and runs a ModuleScript, returning its result.', signature: 'require(module: ModuleScript): any' },
  getmetatable: { label: 'getmetatable', documentation: 'Returns the metatable of the given table.', signature: 'getmetatable(t: table): table?' },
  setmetatable: { label: 'setmetatable', documentation: 'Sets the metatable for a table and returns the table.', signature: 'setmetatable(t: table, mt: table?): table' },
  rawget: { label: 'rawget', documentation: 'Gets table[key] without invoking __index metamethod.', signature: 'rawget(t: table, key: any): any' },
  rawset: { label: 'rawset', documentation: 'Sets table[key] = value without invoking __newindex metamethod.', signature: 'rawset(t: table, key: any, value: any): table' },
  rawequal: { label: 'rawequal', documentation: 'Compares two values without invoking __eq metamethod.', signature: 'rawequal(a: any, b: any): boolean' },
  loadstring: { label: 'loadstring', documentation: 'Compiles a string as Lua code and returns it as a function.', signature: 'loadstring(source: string, chunkname?: string): function?' },

  game: { label: 'game', documentation: 'The DataModel instance representing the current game.', signature: 'game: DataModel' },
  workspace: { label: 'workspace', documentation: 'The Workspace service containing all 3D objects.', signature: 'workspace: Workspace' },
  script: { label: 'script', documentation: 'Reference to the currently running Script or LocalScript.', signature: 'script: Script | LocalScript' },
  shared: { label: 'shared', documentation: 'A table shared between all scripts (not replicated).', signature: 'shared: table' },

  Players: { label: 'Players', documentation: 'Service that manages all Player objects in the game.', signature: 'Players: Players' },
  Workspace: { label: 'Workspace', documentation: 'Service containing all visible 3D objects.', signature: 'Workspace: Workspace' },
  ReplicatedStorage: { label: 'ReplicatedStorage', documentation: 'Storage replicated to all clients. Good for shared modules and assets.', signature: 'ReplicatedStorage: ReplicatedStorage' },
  ReplicatedFirst: { label: 'ReplicatedFirst', documentation: 'Replicated to clients before anything else. Used for loading screens.', signature: 'ReplicatedFirst: ReplicatedFirst' },
  ServerStorage: { label: 'ServerStorage', documentation: 'Server-only storage. Not accessible from clients.', signature: 'ServerStorage: ServerStorage' },
  ServerScriptService: { label: 'ServerScriptService', documentation: 'Contains server-side scripts. Not accessible from clients.', signature: 'ServerScriptService: ServerScriptService' },
  StarterGui: { label: 'StarterGui', documentation: 'GUI templates copied to each player\'s PlayerGui on spawn.', signature: 'StarterGui: StarterGui' },
  StarterPack: { label: 'StarterPack', documentation: 'Tools given to players on spawn.', signature: 'StarterPack: StarterPack' },
  StarterPlayer: { label: 'StarterPlayer', documentation: 'Player character settings and scripts.', signature: 'StarterPlayer: StarterPlayer' },
  Lighting: { label: 'Lighting', documentation: 'Controls lighting, time of day, and atmosphere.', signature: 'Lighting: Lighting' },
  SoundService: { label: 'SoundService', documentation: 'Controls audio properties and 3D sound.', signature: 'SoundService: SoundService' },
  TweenService: { label: 'TweenService', documentation: 'Creates smooth property animations.', signature: 'TweenService: TweenService' },
  RunService: { label: 'RunService', documentation: 'Game loop control with Heartbeat, RenderStepped, Stepped events.', signature: 'RunService: RunService' },
  UserInputService: { label: 'UserInputService', documentation: 'Handles keyboard, mouse, touch, and gamepad input.', signature: 'UserInputService: UserInputService' },
  ContextActionService: { label: 'ContextActionService', documentation: 'Binds actions to multiple input types.', signature: 'ContextActionService: ContextActionService' },
  HttpService: { label: 'HttpService', documentation: 'HTTP requests and JSON encode/decode utilities.', signature: 'HttpService: HttpService' },
  MarketplaceService: { label: 'MarketplaceService', documentation: 'Developer products, game passes, and purchases.', signature: 'MarketplaceService: MarketplaceService' },
  DataStoreService: { label: 'DataStoreService', documentation: 'Persistent cloud data storage.', signature: 'DataStoreService: DataStoreService' },
  MessagingService: { label: 'MessagingService', documentation: 'Cross-server pub/sub messaging.', signature: 'MessagingService: MessagingService' },
  TeleportService: { label: 'TeleportService', documentation: 'Teleport players between places.', signature: 'TeleportService: TeleportService' },
  TextService: { label: 'TextService', documentation: 'Text filtering and size calculation.', signature: 'TextService: TextService' },
  PathfindingService: { label: 'PathfindingService', documentation: 'AI pathfinding and navigation.', signature: 'PathfindingService: PathfindingService' },
  PhysicsService: { label: 'PhysicsService', documentation: 'Collision groups and physics settings.', signature: 'PhysicsService: PhysicsService' },
  CollectionService: { label: 'CollectionService', documentation: 'Tag-based instance management.', signature: 'CollectionService: CollectionService' },
  Debris: { label: 'Debris', documentation: 'Scheduled instance destruction.', signature: 'Debris: Debris' },
  Chat: { label: 'Chat', documentation: 'Chat system control.', signature: 'Chat: Chat' },
  Teams: { label: 'Teams', documentation: 'Team management.', signature: 'Teams: Teams' },
  MemoryStoreService: { label: 'MemoryStoreService', documentation: 'Temporary cross-server storage with TTL.', signature: 'MemoryStoreService: MemoryStoreService' },

  FindFirstChild: { label: 'FindFirstChild', documentation: 'Returns the first child with the given name, or nil.', signature: 'FindFirstChild(name: string, recursive?: boolean): Instance?' },
  FindFirstChildOfClass: { label: 'FindFirstChildOfClass', documentation: 'Returns the first child of the exact class type.', signature: 'FindFirstChildOfClass(className: string): Instance?' },
  FindFirstChildWhichIsA: { label: 'FindFirstChildWhichIsA', documentation: 'Returns the first child that inherits from the class.', signature: 'FindFirstChildWhichIsA(className: string, recursive?: boolean): Instance?' },
  FindFirstAncestor: { label: 'FindFirstAncestor', documentation: 'Returns the first ancestor with the given name.', signature: 'FindFirstAncestor(name: string): Instance?' },
  FindFirstAncestorOfClass: { label: 'FindFirstAncestorOfClass', documentation: 'Returns the first ancestor of the exact class type.', signature: 'FindFirstAncestorOfClass(className: string): Instance?' },
  WaitForChild: { label: 'WaitForChild', documentation: 'Yields until a child with the name exists, then returns it.', signature: 'WaitForChild(name: string, timeout?: number): Instance?' },
  GetChildren: { label: 'GetChildren', documentation: 'Returns an array of all direct children.', signature: 'GetChildren(): {Instance}' },
  GetDescendants: { label: 'GetDescendants', documentation: 'Returns an array of all descendants.', signature: 'GetDescendants(): {Instance}' },
  IsA: { label: 'IsA', documentation: 'Returns true if the instance is or inherits from the class.', signature: 'IsA(className: string): boolean' },
  IsDescendantOf: { label: 'IsDescendantOf', documentation: 'Returns true if this is a descendant of the ancestor.', signature: 'IsDescendantOf(ancestor: Instance): boolean' },
  IsAncestorOf: { label: 'IsAncestorOf', documentation: 'Returns true if this is an ancestor of the descendant.', signature: 'IsAncestorOf(descendant: Instance): boolean' },
  Destroy: { label: 'Destroy', documentation: 'Destroys the instance and all descendants. Cannot be undone.', signature: 'Destroy(): void' },
  Clone: { label: 'Clone', documentation: 'Creates a deep copy of the instance and descendants.', signature: 'Clone(): Instance' },
  GetAttribute: { label: 'GetAttribute', documentation: 'Returns the value of the named attribute.', signature: 'GetAttribute(name: string): any' },
  SetAttribute: { label: 'SetAttribute', documentation: 'Sets the value of the named attribute.', signature: 'SetAttribute(name: string, value: any): void' },
  GetAttributes: { label: 'GetAttributes', documentation: 'Returns a dictionary of all attributes.', signature: 'GetAttributes(): {[string]: any}' },
  GetPropertyChangedSignal: { label: 'GetPropertyChangedSignal', documentation: 'Returns a signal that fires when the property changes.', signature: 'GetPropertyChangedSignal(property: string): RBXScriptSignal' },
  GetFullName: { label: 'GetFullName', documentation: 'Returns the full hierarchy path as a string.', signature: 'GetFullName(): string' },
  GetService: { label: 'GetService', documentation: 'Returns a service by name from the DataModel.', signature: 'GetService(serviceName: string): Instance' },

  LocalPlayer: { label: 'LocalPlayer', documentation: 'The Player object for the local client. Only available on clients.', signature: 'LocalPlayer: Player' },
  Character: { label: 'Character', documentation: 'The player\'s current character Model.', signature: 'Character: Model?' },
  CharacterAdded: { label: 'CharacterAdded', documentation: 'Fires when a new character spawns.', signature: 'CharacterAdded: RBXScriptSignal<Model>' },
  PlayerAdded: { label: 'PlayerAdded', documentation: 'Fires when a player joins the server.', signature: 'PlayerAdded: RBXScriptSignal<Player>' },
  PlayerRemoving: { label: 'PlayerRemoving', documentation: 'Fires when a player is leaving the server.', signature: 'PlayerRemoving: RBXScriptSignal<Player>' },
  GetPlayers: { label: 'GetPlayers', documentation: 'Returns an array of all current players.', signature: 'GetPlayers(): {Player}' },
  GetPlayerFromCharacter: { label: 'GetPlayerFromCharacter', documentation: 'Returns the Player from a character Model.', signature: 'GetPlayerFromCharacter(character: Model): Player?' },
  PlayerGui: { label: 'PlayerGui', documentation: 'Container for the player\'s GUI elements.', signature: 'PlayerGui: PlayerGui' },
  Backpack: { label: 'Backpack', documentation: 'Container for the player\'s tools.', signature: 'Backpack: Backpack' },
  UserId: { label: 'UserId', documentation: 'The unique numeric ID of the player.', signature: 'UserId: number' },
  DisplayName: { label: 'DisplayName', documentation: 'The player\'s display name.', signature: 'DisplayName: string' },
  Kick: { label: 'Kick', documentation: 'Kicks the player from the server.', signature: 'Kick(message?: string): void' },
  LoadCharacter: { label: 'LoadCharacter', documentation: 'Respawns the player\'s character.', signature: 'LoadCharacter(): void' },
  GetMouse: { label: 'GetMouse', documentation: 'Returns the player\'s Mouse object. Client only.', signature: 'GetMouse(): Mouse' },

  Vector3: { label: 'Vector3', documentation: 'A 3D vector with x, y, z components.', signature: 'Vector3' },
  Vector2: { label: 'Vector2', documentation: 'A 2D vector with x, y components.', signature: 'Vector2' },
  CFrame: { label: 'CFrame', documentation: 'A coordinate frame representing position and rotation.', signature: 'CFrame' },
  Color3: { label: 'Color3', documentation: 'An RGB color with components from 0 to 1.', signature: 'Color3' },
  UDim: { label: 'UDim', documentation: 'A 1D size/position with scale and offset.', signature: 'UDim' },
  UDim2: { label: 'UDim2', documentation: 'A 2D size/position with scale and offset for X and Y.', signature: 'UDim2' },
  TweenInfo: { label: 'TweenInfo', documentation: 'Configuration for tween animations.', signature: 'TweenInfo' },
  RaycastParams: { label: 'RaycastParams', documentation: 'Parameters for raycasting operations.', signature: 'RaycastParams' },
  OverlapParams: { label: 'OverlapParams', documentation: 'Parameters for overlap queries.', signature: 'OverlapParams' },
  Instance: { label: 'Instance', documentation: 'Base class for all Roblox objects.', signature: 'Instance' },

  getgenv: { label: 'getgenv', documentation: 'Returns the global environment table shared across all executor scripts.', signature: 'getgenv(): table' },
  getrenv: { label: 'getrenv', documentation: 'Returns the Roblox global environment table.', signature: 'getrenv(): table' },
  getsenv: { label: 'getsenv', documentation: 'Returns the environment table of a running script.', signature: 'getsenv(script: Script): table' },
  getgc: { label: 'getgc', documentation: 'Returns a list of all garbage-collected objects, optionally including tables.', signature: 'getgc(includeTables?: boolean): {any}' },
  filtergc: { label: 'filtergc', documentation: 'Retrieves specific garbage-collected values using fine-tuned filters.', signature: 'filtergc(filterType: "function"|"table", filterOptions: FilterOptions, returnOne?: boolean): any' },
  getreg: { label: 'getreg', documentation: 'Returns the Lua registry table.', signature: 'getreg(): table' },
  getinstances: { label: 'getinstances', documentation: 'Returns all Instance objects in the game.', signature: 'getinstances(): {Instance}' },
  getnilinstances: { label: 'getnilinstances', documentation: 'Returns all instances parented to nil.', signature: 'getnilinstances(): {Instance}' },
  getscripts: { label: 'getscripts', documentation: 'Returns all script instances in the game.', signature: 'getscripts(): {Script}' },
  getloadedmodules: { label: 'getloadedmodules', documentation: 'Returns all loaded ModuleScripts.', signature: 'getloadedmodules(): {ModuleScript}' },
  getrunningscripts: { label: 'getrunningscripts', documentation: 'Returns all currently running scripts.', signature: 'getrunningscripts(): {Script}' },
  getcallingscript: { label: 'getcallingscript', documentation: 'Returns the script that called this function.', signature: 'getcallingscript(): Script?' },
  getscriptclosure: { label: 'getscriptclosure', documentation: 'Returns the top-level function (closure) of a given script.', signature: 'getscriptclosure(script: Script): function' },
  getscripthash: { label: 'getscripthash', documentation: 'Returns the hash of a script\'s bytecode.', signature: 'getscripthash(script: Script): string' },
  getscriptbytecode: { label: 'getscriptbytecode', documentation: 'Returns the raw bytecode of a script.', signature: 'getscriptbytecode(script: Script): string' },
  getthreadidentity: { label: 'getthreadidentity', documentation: 'Returns the current thread\'s identity level.', signature: 'getthreadidentity(): number' },
  setthreadidentity: { label: 'setthreadidentity', documentation: 'Sets the current thread\'s identity level.', signature: 'setthreadidentity(level: number): void' },

  hookfunction: { label: 'hookfunction', documentation: 'Hooks a function, replacing it with a hook. Returns the original.', signature: 'hookfunction(original: function, hook: function): function' },
  hookmetamethod: { label: 'hookmetamethod', documentation: 'Hooks a metamethod on an object\'s metatable. Returns the original metamethod.', signature: 'hookmetamethod(object: any, method: string, hook: function): function' },
  restorefunction: { label: 'restorefunction', documentation: 'Restores a hooked function back to the original. Errors if not hooked.', signature: 'restorefunction(func: (...any) -> ()): ()' },
  newcclosure: { label: 'newcclosure', documentation: 'Wraps a Lua function in a C closure.', signature: 'newcclosure(func: function): function' },
  iscclosure: { label: 'iscclosure', documentation: 'Returns true if the function is a C closure.', signature: 'iscclosure(func: function): boolean' },
  islclosure: { label: 'islclosure', documentation: 'Returns true if the function is a Lua closure.', signature: 'islclosure(func: function): boolean' },
  isexecutorclosure: { label: 'isexecutorclosure', documentation: 'Returns true if the function originates from the executor.', signature: 'isexecutorclosure(func: function): boolean' },
  checkcaller: { label: 'checkcaller', documentation: 'Returns true if current function was invoked from the executor\'s own thread.', signature: 'checkcaller(): boolean' },
  clonefunction: { label: 'clonefunction', documentation: 'Creates an independent copy of a function.', signature: 'clonefunction(func: function): function' },
  getfunctionhash: { label: 'getfunctionhash', documentation: 'Returns hex-represented SHA384 hash of a function\'s instructions and constants.', signature: 'getfunctionhash(func: (...any) -> (...any)): string' },
  getrawmetatable: { label: 'getrawmetatable', documentation: 'Gets metatable bypassing __metatable protection.', signature: 'getrawmetatable(object: any): table?' },
  setrawmetatable: { label: 'setrawmetatable', documentation: 'Sets metatable bypassing __metatable protection.', signature: 'setrawmetatable(object: any, metatable: table?): void' },
  getnamecallmethod: { label: 'getnamecallmethod', documentation: 'Returns the method name from the most recent __namecall invocation.', signature: 'getnamecallmethod(): string' },
  gethiddenproperty: { label: 'gethiddenproperty', documentation: 'Gets the value of a hidden property on an Instance.', signature: 'gethiddenproperty(instance: Instance, property: string): (any, boolean)' },
  sethiddenproperty: { label: 'sethiddenproperty', documentation: 'Sets the value of a hidden property on an Instance.', signature: 'sethiddenproperty(instance: Instance, property: string, value: any): boolean' },
  setreadonly: { label: 'setreadonly', documentation: 'Sets whether a table is read-only.', signature: 'setreadonly(table: table, readonly: boolean): void' },
  isreadonly: { label: 'isreadonly', documentation: 'Returns true if the table is read-only.', signature: 'isreadonly(table: table): boolean' },
  isscriptable: { label: 'isscriptable', documentation: 'Returns whether a given property of an Instance is scriptable.', signature: 'isscriptable(object: Instance, property: string): boolean | nil' },
  setscriptable: { label: 'setscriptable', documentation: 'Toggles the scriptability of a property on an Instance.', signature: 'setscriptable(instance: Instance, property: string, state: boolean): boolean | nil' },

  getconnections: { label: 'getconnections', documentation: 'Returns all connections attached to a RBXScriptSignal.', signature: 'getconnections(signal: RBXScriptSignal): {Connection}' },
  firesignal: { label: 'firesignal', documentation: 'Fires all connected handlers of a RBXScriptSignal with the given arguments.', signature: 'firesignal(signal: RBXScriptSignal, ...args): void' },
  replicatesignal: { label: 'replicatesignal', documentation: 'Replicates a signal to the server.', signature: 'replicatesignal(signal: RBXScriptSignal, ...: any?): ()' },

  readfile: { label: 'readfile', documentation: 'Reads file contents as a string from the workspace folder.', signature: 'readfile(path: string): string' },
  writefile: { label: 'writefile', documentation: 'Writes a string to a file in the workspace folder.', signature: 'writefile(path: string, content: string): void' },
  appendfile: { label: 'appendfile', documentation: 'Appends a string to an existing file in the workspace folder.', signature: 'appendfile(path: string, content: string): void' },
  loadfile: { label: 'loadfile', documentation: 'Loads a file as a Lua chunk and returns it as a function.', signature: 'loadfile(path: string): function?' },
  isfile: { label: 'isfile', documentation: 'Returns true if the path points to an existing file.', signature: 'isfile(path: string): boolean' },
  isfolder: { label: 'isfolder', documentation: 'Returns true if the path points to an existing folder.', signature: 'isfolder(path: string): boolean' },
  makefolder: { label: 'makefolder', documentation: 'Creates a new folder at the specified path.', signature: 'makefolder(path: string): void' },
  delfolder: { label: 'delfolder', documentation: 'Deletes a folder at the specified path.', signature: 'delfolder(path: string): void' },
  delfile: { label: 'delfile', documentation: 'Deletes a file at the specified path.', signature: 'delfile(path: string): void' },
  listfiles: { label: 'listfiles', documentation: 'Returns an array of file and folder paths in a directory.', signature: 'listfiles(path: string): {string}' },
  getcustomasset: { label: 'getcustomasset', documentation: 'Returns an rbxasset:// content URL for a local workspace file.', signature: 'getcustomasset(path: string): string' },

  fireclickdetector: { label: 'fireclickdetector', documentation: 'Fires a ClickDetector as if the player clicked it.', signature: 'fireclickdetector(detector: ClickDetector, distance?: number): void' },
  fireproximityprompt: { label: 'fireproximityprompt', documentation: 'Fires a ProximityPrompt as if the player triggered it.', signature: 'fireproximityprompt(prompt: ProximityPrompt): void' },
  firetouchinterest: { label: 'firetouchinterest', documentation: 'Simulates a touch between two parts. toggle: 0=end, 1=start.', signature: 'firetouchinterest(part1: BasePart, part2: BasePart, toggle: number): void' },
  getcallbackvalue: { label: 'getcallbackvalue', documentation: 'Retrieves the assigned callback property from an Instance.', signature: 'getcallbackvalue(object: Instance, property: string): any | nil' },

  request: { label: 'request', documentation: 'Makes an HTTP request with full configuration. Returns response table.', signature: 'request(options: RequestOptions): Response' },

  gethui: { label: 'gethui', documentation: 'Returns the hidden UI container for storing GUI elements invisibly.', signature: 'gethui(): Instance' },
  identifyexecutor: { label: 'identifyexecutor', documentation: 'Returns the executor name and version as two strings.', signature: 'identifyexecutor(): (string, string)' },
  cloneref: { label: 'cloneref', documentation: 'Creates a new reference to an Instance that bypasses reference equality checks.', signature: 'cloneref(instance: Instance): Instance' },
  compareinstances: { label: 'compareinstances', documentation: 'Compares two instance references, returning true if they point to the same object.', signature: 'compareinstances(a: Instance, b: Instance): boolean' },

  Drawing: { label: 'Drawing', documentation: 'Drawing library for creating 2D overlays and shapes on screen.', signature: 'Drawing' },
  WebSocket: { label: 'WebSocket', documentation: 'WebSocket client for establishing real-time bidirectional connections.', signature: 'WebSocket' },
  raknet: { label: 'raknet', documentation: 'RakNet networking library for hooking, sending, and receiving packets.', signature: 'raknet' },

  base64encode: { label: 'base64encode', documentation: 'Encodes a string to Base64 representation.', signature: 'base64encode(data: string): string' },
  base64decode: { label: 'base64decode', documentation: 'Decodes a Base64 string back to the original data.', signature: 'base64decode(data: string): string' },
  lz4compress: { label: 'lz4compress', documentation: 'Compresses data using the LZ4 algorithm.', signature: 'lz4compress(data: string): string' },
  lz4decompress: { label: 'lz4decompress', documentation: 'Decompresses LZ4-compressed data back to original.', signature: 'lz4decompress(data: string, size: number): string' },

  cleardrawcache: { label: 'cleardrawcache', documentation: 'Removes all active drawing objects created with Drawing.new.', signature: 'cleardrawcache(): ()' },
  getrenderproperty: { label: 'getrenderproperty', documentation: 'Retrieves the value of a property from a Drawing object.', signature: 'getrenderproperty(drawing: Drawing, property: string): any' },
  setrenderproperty: { label: 'setrenderproperty', documentation: 'Assigns a value to a property of a Drawing object.', signature: 'setrenderproperty(drawing: Drawing, property: string, value: any): ()' },
  isrenderobj: { label: 'isrenderobj', documentation: 'Checks whether a given value is a valid Drawing object.', signature: 'isrenderobj(object: any): boolean' },

  wait: { label: 'wait', documentation: 'Yields the thread for the specified time. Deprecated: use task.wait.', signature: 'wait(seconds?: number): (number, number)' },
  spawn: { label: 'spawn', documentation: 'Runs function in new thread after brief delay. Deprecated: use task.spawn.', signature: 'spawn(callback: function): void' },
  delay: { label: 'delay', documentation: 'Runs function after delay. Deprecated: use task.delay.', signature: 'delay(seconds: number, callback: function): void' },
};

const LIBRARY_MEMBERS: Record<string, Record<string, HoverInfo>> = {
  math: {
    abs: { label: 'math.abs', documentation: 'Returns the absolute value.', signature: 'math.abs(x: number): number' },
    ceil: { label: 'math.ceil', documentation: 'Rounds up to the nearest integer.', signature: 'math.ceil(x: number): number' },
    floor: { label: 'math.floor', documentation: 'Rounds down to the nearest integer.', signature: 'math.floor(x: number): number' },
    round: { label: 'math.round', documentation: 'Rounds to the nearest integer.', signature: 'math.round(x: number): number' },
    clamp: { label: 'math.clamp', documentation: 'Clamps value between min and max.', signature: 'math.clamp(x: number, min: number, max: number): number' },
    min: { label: 'math.min', documentation: 'Returns the minimum value.', signature: 'math.min(...numbers): number' },
    max: { label: 'math.max', documentation: 'Returns the maximum value.', signature: 'math.max(...numbers): number' },
    sin: { label: 'math.sin', documentation: 'Returns the sine of x (radians).', signature: 'math.sin(x: number): number' },
    cos: { label: 'math.cos', documentation: 'Returns the cosine of x (radians).', signature: 'math.cos(x: number): number' },
    tan: { label: 'math.tan', documentation: 'Returns the tangent of x (radians).', signature: 'math.tan(x: number): number' },
    asin: { label: 'math.asin', documentation: 'Returns the arc sine of x.', signature: 'math.asin(x: number): number' },
    acos: { label: 'math.acos', documentation: 'Returns the arc cosine of x.', signature: 'math.acos(x: number): number' },
    atan: { label: 'math.atan', documentation: 'Returns the arc tangent of x.', signature: 'math.atan(x: number): number' },
    atan2: { label: 'math.atan2', documentation: 'Returns the arc tangent of y/x.', signature: 'math.atan2(y: number, x: number): number' },
    rad: { label: 'math.rad', documentation: 'Converts degrees to radians.', signature: 'math.rad(degrees: number): number' },
    deg: { label: 'math.deg', documentation: 'Converts radians to degrees.', signature: 'math.deg(radians: number): number' },
    sqrt: { label: 'math.sqrt', documentation: 'Returns the square root.', signature: 'math.sqrt(x: number): number' },
    pow: { label: 'math.pow', documentation: 'Returns x raised to power y.', signature: 'math.pow(x: number, y: number): number' },
    exp: { label: 'math.exp', documentation: 'Returns e raised to power x.', signature: 'math.exp(x: number): number' },
    log: { label: 'math.log', documentation: 'Returns the natural logarithm.', signature: 'math.log(x: number, base?: number): number' },
    log10: { label: 'math.log10', documentation: 'Returns the base-10 logarithm.', signature: 'math.log10(x: number): number' },
    random: { label: 'math.random', documentation: 'Returns a random number.', signature: 'math.random(m?: number, n?: number): number' },
    randomseed: { label: 'math.randomseed', documentation: 'Sets the random seed.', signature: 'math.randomseed(seed: number): void' },
    noise: { label: 'math.noise', documentation: 'Returns Perlin noise value.', signature: 'math.noise(x: number, y?: number, z?: number): number' },
    sign: { label: 'math.sign', documentation: 'Returns -1, 0, or 1 based on sign.', signature: 'math.sign(x: number): number' },
    pi: { label: 'math.pi', documentation: 'The mathematical constant pi (3.14159...).', signature: 'math.pi: number' },
    huge: { label: 'math.huge', documentation: 'Positive infinity.', signature: 'math.huge: number' },
  },
  string: {
    sub: { label: 'string.sub', documentation: 'Extracts a substring from i to j.', signature: 'string.sub(s: string, i: number, j?: number): string' },
    len: { label: 'string.len', documentation: 'Returns the length of the string.', signature: 'string.len(s: string): number' },
    lower: { label: 'string.lower', documentation: 'Converts to lowercase.', signature: 'string.lower(s: string): string' },
    upper: { label: 'string.upper', documentation: 'Converts to uppercase.', signature: 'string.upper(s: string): string' },
    find: { label: 'string.find', documentation: 'Finds pattern in string, returns start and end indices.', signature: 'string.find(s: string, pattern: string, init?: number, plain?: boolean): (number?, number?)' },
    match: { label: 'string.match', documentation: 'Returns captures from pattern match.', signature: 'string.match(s: string, pattern: string, init?: number): string?' },
    gmatch: { label: 'string.gmatch', documentation: 'Returns an iterator for pattern matches.', signature: 'string.gmatch(s: string, pattern: string): iterator' },
    gsub: { label: 'string.gsub', documentation: 'Replaces pattern occurrences.', signature: 'string.gsub(s: string, pattern: string, repl: string | table | function, n?: number): (string, number)' },
    format: { label: 'string.format', documentation: 'Formats string like printf.', signature: 'string.format(format: string, ...args): string' },
    rep: { label: 'string.rep', documentation: 'Repeats string n times.', signature: 'string.rep(s: string, n: number, sep?: string): string' },
    reverse: { label: 'string.reverse', documentation: 'Reverses the string.', signature: 'string.reverse(s: string): string' },
    split: { label: 'string.split', documentation: 'Splits string by separator.', signature: 'string.split(s: string, separator?: string): {string}' },
    byte: { label: 'string.byte', documentation: 'Returns byte values of characters.', signature: 'string.byte(s: string, i?: number, j?: number): ...number' },
    char: { label: 'string.char', documentation: 'Converts bytes to string.', signature: 'string.char(...bytes): string' },
    pack: { label: 'string.pack', documentation: 'Packs values into binary string.', signature: 'string.pack(format: string, ...values): string' },
    unpack: { label: 'string.unpack', documentation: 'Unpacks binary string to values.', signature: 'string.unpack(format: string, s: string, pos?: number): ...any' },
    packsize: { label: 'string.packsize', documentation: 'Returns size of packed format.', signature: 'string.packsize(format: string): number' },
  },
  table: {
    insert: { label: 'table.insert', documentation: 'Inserts value into array.', signature: 'table.insert(t: table, pos?: number, value: any): void' },
    remove: { label: 'table.remove', documentation: 'Removes and returns element.', signature: 'table.remove(t: table, pos?: number): any' },
    sort: { label: 'table.sort', documentation: 'Sorts array in place.', signature: 'table.sort(t: table, comp?: function): void' },
    concat: { label: 'table.concat', documentation: 'Concatenates array elements.', signature: 'table.concat(t: table, sep?: string, i?: number, j?: number): string' },
    find: { label: 'table.find', documentation: 'Finds value in array, returns index.', signature: 'table.find(t: table, value: any, init?: number): number?' },
    clear: { label: 'table.clear', documentation: 'Removes all elements from table.', signature: 'table.clear(t: table): void' },
    clone: { label: 'table.clone', documentation: 'Creates a shallow copy.', signature: 'table.clone(t: table): table' },
    freeze: { label: 'table.freeze', documentation: 'Makes table read-only.', signature: 'table.freeze(t: table): table' },
    isfrozen: { label: 'table.isfrozen', documentation: 'Returns true if table is frozen.', signature: 'table.isfrozen(t: table): boolean' },
    create: { label: 'table.create', documentation: 'Creates array with count elements.', signature: 'table.create(count: number, value?: any): table' },
    pack: { label: 'table.pack', documentation: 'Packs arguments into table.', signature: 'table.pack(...args): table' },
    unpack: { label: 'table.unpack', documentation: 'Unpacks table to values.', signature: 'table.unpack(t: table, i?: number, j?: number): ...any' },
    move: { label: 'table.move', documentation: 'Moves elements between tables.', signature: 'table.move(src: table, a: number, b: number, dest: number, target?: table): table' },
  },
  task: {
    spawn: { label: 'task.spawn', documentation: 'Runs function immediately in a new thread.', signature: 'task.spawn(func: function, ...args): thread' },
    defer: { label: 'task.defer', documentation: 'Runs function after current resumption cycle.', signature: 'task.defer(func: function, ...args): thread' },
    delay: { label: 'task.delay', documentation: 'Runs function after delay.', signature: 'task.delay(seconds: number, func: function, ...args): thread' },
    wait: { label: 'task.wait', documentation: 'Yields for specified time.', signature: 'task.wait(seconds?: number): number' },
    cancel: { label: 'task.cancel', documentation: 'Cancels a scheduled thread.', signature: 'task.cancel(thread: thread): void' },
    synchronize: { label: 'task.synchronize', documentation: 'Switches to synchronized execution.', signature: 'task.synchronize(): void' },
    desynchronize: { label: 'task.desynchronize', documentation: 'Switches to parallel execution.', signature: 'task.desynchronize(): void' },
  },
  debug: {
    getinfo: { label: 'debug.getinfo', documentation: 'Returns function info table.', signature: 'debug.getinfo(func: function | number, what?: string): table' },
    getconstant: { label: 'debug.getconstant', documentation: 'Gets a constant at the given index from a function\'s constant table.', signature: 'debug.getconstant(func: function, index: number): any' },
    setconstant: { label: 'debug.setconstant', documentation: 'Sets a constant at the given index in a function\'s constant table.', signature: 'debug.setconstant(func: function, index: number, value: any): void' },
    getconstants: { label: 'debug.getconstants', documentation: 'Returns all constants from a function\'s constant table.', signature: 'debug.getconstants(func: function): table' },
    getupvalue: { label: 'debug.getupvalue', documentation: 'Gets an upvalue at the given index from a function.', signature: 'debug.getupvalue(func: function, index: number): any' },
    setupvalue: { label: 'debug.setupvalue', documentation: 'Sets an upvalue at the given index in a function.', signature: 'debug.setupvalue(func: function, index: number, value: any): void' },
    getupvalues: { label: 'debug.getupvalues', documentation: 'Returns all upvalues from a function.', signature: 'debug.getupvalues(func: function): table' },
    getproto: { label: 'debug.getproto', documentation: 'Gets a proto (inner function) at the given index. If active is true, returns active closures.', signature: 'debug.getproto(func: function, index: number, active?: boolean): function | table' },
    getprotos: { label: 'debug.getprotos', documentation: 'Returns all protos (inner functions) from a function.', signature: 'debug.getprotos(func: function): table' },
    getstack: { label: 'debug.getstack', documentation: 'Gets a value from the stack at the given level and optional index.', signature: 'debug.getstack(level: number, index?: number): any' },
    setstack: { label: 'debug.setstack', documentation: 'Sets a value on the stack at the given level and index.', signature: 'debug.setstack(level: number, index: number, value: any): void' },
    traceback: { label: 'debug.traceback', documentation: 'Returns stack traceback string.', signature: 'debug.traceback(thread?: thread, message?: string, level?: number): string' },
  },
  raknet: {
    add_send_hook: { label: 'raknet.add_send_hook', documentation: 'Adds hook to raknet send, returns the hook to be used with raknet.remove_send_hook.', signature: 'raknet.add_send_hook(hook: (message: RakNetMessage) -> ()): (message: RakNetMessage) -> ()' },
    remove_send_hook: { label: 'raknet.remove_send_hook', documentation: 'Removes hook from raknet send.', signature: 'raknet.remove_send_hook(hook: (message: RakNetMessage) -> ()): void' },
    send: { label: 'raknet.send', documentation: 'Sends data over raknet.', signature: 'raknet.send(data: buffer|string|{number}, priority?: number, reliability?: number, ordering_channel?: number): void' },
    add_receive_hook: { label: 'raknet.add_receive_hook', documentation: 'Adds hook to raknet receive, returns the hook to be used with raknet.remove_receive_hook.', signature: 'raknet.add_receive_hook(hook: (message: RakNetMessage) -> ()): (message: RakNetMessage) -> ()' },
    remove_receive_hook: { label: 'raknet.remove_receive_hook', documentation: 'Removes hook from raknet receive.', signature: 'raknet.remove_receive_hook(hook: (message: RakNetMessage) -> ()): void' },
    receive: { label: 'raknet.receive', documentation: 'Receives data over raknet.', signature: 'raknet.receive(data: buffer|string|{number}): void' },
  },
};

const SIGNATURES: Record<string, FunctionSignature> = {
  print: { label: 'print(...any)', documentation: 'Outputs values to the console.', parameters: [{ label: '...any', documentation: 'Values to print' }] },
  warn: { label: 'warn(...any)', documentation: 'Outputs warning message in yellow.', parameters: [{ label: '...any', documentation: 'Values to print as warning' }] },
  error: { label: 'error(message, level?)', documentation: 'Raises an error.', parameters: [{ label: 'message', documentation: 'Error message' }, { label: 'level?', documentation: 'Stack level (0=no stack, 1=current)' }] },
  assert: { label: 'assert(condition, message?)', documentation: 'Raises error if condition is falsy.', parameters: [{ label: 'condition', documentation: 'Condition to check' }, { label: 'message?', documentation: 'Error message if assertion fails' }] },
  type: { label: 'type(value)', documentation: 'Returns Lua type as string.', parameters: [{ label: 'value', documentation: 'Value to check type of' }] },
  typeof: { label: 'typeof(value)', documentation: 'Returns Roblox type as string.', parameters: [{ label: 'value', documentation: 'Value to check type of' }] },
  tostring: { label: 'tostring(value)', documentation: 'Converts to string.', parameters: [{ label: 'value', documentation: 'Value to convert' }] },
  tonumber: { label: 'tonumber(value, base?)', documentation: 'Converts to number.', parameters: [{ label: 'value', documentation: 'Value to convert' }, { label: 'base?', documentation: 'Number base (2-36)' }] },
  pairs: { label: 'pairs(table)', documentation: 'Iterator for key-value pairs.', parameters: [{ label: 'table', documentation: 'Table to iterate' }] },
  ipairs: { label: 'ipairs(table)', documentation: 'Iterator for array indices.', parameters: [{ label: 'table', documentation: 'Array to iterate' }] },
  next: { label: 'next(table, key?)', documentation: 'Returns next key-value pair.', parameters: [{ label: 'table', documentation: 'Table to get next from' }, { label: 'key?', documentation: 'Current key' }] },
  select: { label: 'select(index, ...)', documentation: 'Returns args from index.', parameters: [{ label: 'index', documentation: 'Start index or "#" for count' }, { label: '...', documentation: 'Arguments' }] },
  unpack: { label: 'unpack(table, i?, j?)', documentation: 'Returns table elements.', parameters: [{ label: 'table', documentation: 'Table to unpack' }, { label: 'i?', documentation: 'Start index' }, { label: 'j?', documentation: 'End index' }] },
  pcall: { label: 'pcall(func, ...)', documentation: 'Protected call.', parameters: [{ label: 'func', documentation: 'Function to call' }, { label: '...', documentation: 'Arguments' }] },
  xpcall: { label: 'xpcall(func, errorHandler, ...)', documentation: 'Protected call with error handler.', parameters: [{ label: 'func', documentation: 'Function to call' }, { label: 'errorHandler', documentation: 'Error handler function' }, { label: '...', documentation: 'Arguments' }] },
  require: { label: 'require(module)', documentation: 'Loads a ModuleScript.', parameters: [{ label: 'module', documentation: 'ModuleScript to load' }] },
  getmetatable: { label: 'getmetatable(table)', documentation: 'Gets metatable.', parameters: [{ label: 'table', documentation: 'Table to get metatable from' }] },
  setmetatable: { label: 'setmetatable(table, metatable)', documentation: 'Sets metatable.', parameters: [{ label: 'table', documentation: 'Table to set metatable on' }, { label: 'metatable', documentation: 'Metatable to set' }] },
  rawget: { label: 'rawget(table, key)', documentation: 'Gets without metamethods.', parameters: [{ label: 'table', documentation: 'Table' }, { label: 'key', documentation: 'Key to get' }] },
  rawset: { label: 'rawset(table, key, value)', documentation: 'Sets without metamethods.', parameters: [{ label: 'table', documentation: 'Table' }, { label: 'key', documentation: 'Key to set' }, { label: 'value', documentation: 'Value to set' }] },
  loadstring: { label: 'loadstring(source, chunkname?)', documentation: 'Compiles string to function.', parameters: [{ label: 'source', documentation: 'Lua source code' }, { label: 'chunkname?', documentation: 'Name for debugging' }] },

  FindFirstChild: { label: 'FindFirstChild(name, recursive?)', documentation: 'Finds child by name.', parameters: [{ label: 'name', documentation: 'Child name to find' }, { label: 'recursive?', documentation: 'Search descendants' }] },
  FindFirstChildOfClass: { label: 'FindFirstChildOfClass(className)', documentation: 'Finds child of class.', parameters: [{ label: 'className', documentation: 'Class name to find' }] },
  FindFirstChildWhichIsA: { label: 'FindFirstChildWhichIsA(className, recursive?)', documentation: 'Finds child inheriting class.', parameters: [{ label: 'className', documentation: 'Class to check inheritance' }, { label: 'recursive?', documentation: 'Search descendants' }] },
  WaitForChild: { label: 'WaitForChild(name, timeout?)', documentation: 'Waits for child to exist.', parameters: [{ label: 'name', documentation: 'Child name to wait for' }, { label: 'timeout?', documentation: 'Max wait time in seconds' }] },
  IsA: { label: 'IsA(className)', documentation: 'Checks if instance is or inherits class.', parameters: [{ label: 'className', documentation: 'Class name to check' }] },
  GetAttribute: { label: 'GetAttribute(name)', documentation: 'Gets attribute value.', parameters: [{ label: 'name', documentation: 'Attribute name' }] },
  SetAttribute: { label: 'SetAttribute(name, value)', documentation: 'Sets attribute value.', parameters: [{ label: 'name', documentation: 'Attribute name' }, { label: 'value', documentation: 'Value to set' }] },
  GetPropertyChangedSignal: { label: 'GetPropertyChangedSignal(property)', documentation: 'Signal for property changes.', parameters: [{ label: 'property', documentation: 'Property name' }] },
  GetService: { label: 'GetService(serviceName)', documentation: 'Gets a service by name.', parameters: [{ label: 'serviceName', documentation: 'Name of the service' }] },

  hookfunction: { label: 'hookfunction(original, hook)', documentation: 'Hooks a function, replacing it with a hook. Returns the original.', parameters: [{ label: 'original', documentation: 'Function to hook' }, { label: 'hook', documentation: 'Hook function' }] },
  hookmetamethod: { label: 'hookmetamethod(object, method, hook)', documentation: 'Hooks a metamethod on an object\'s metatable.', parameters: [{ label: 'object', documentation: 'Object to hook' }, { label: 'method', documentation: 'Metamethod name' }, { label: 'hook', documentation: 'Hook function' }] },
  restorefunction: { label: 'restorefunction(func)', documentation: 'Restores a hooked function back to the original.', parameters: [{ label: 'func', documentation: 'Hooked function to restore' }] },
  getsenv: { label: 'getsenv(script)', documentation: 'Gets script environment.', parameters: [{ label: 'script', documentation: 'Script to get environment from' }] },
  getscriptclosure: { label: 'getscriptclosure(script)', documentation: 'Gets script closure.', parameters: [{ label: 'script', documentation: 'Script to get closure from' }] },
  filtergc: { label: 'filtergc(filterType, filterOptions, returnOne?)', documentation: 'Retrieves specific garbage-collected values.', parameters: [{ label: 'filterType', documentation: '"function" or "table"' }, { label: 'filterOptions', documentation: 'Filter criteria table' }, { label: 'returnOne?', documentation: 'If true, returns first match only' }] },
  getfunctionhash: { label: 'getfunctionhash(func)', documentation: 'Returns SHA384 hash of function instructions.', parameters: [{ label: 'func', documentation: 'Function to hash (no C closures)' }] },
  getconnections: { label: 'getconnections(signal)', documentation: 'Gets all connections attached to a signal.', parameters: [{ label: 'signal', documentation: 'RBXScriptSignal to get connections from' }] },
  firesignal: { label: 'firesignal(signal, ...)', documentation: 'Fires all connected handlers of a signal.', parameters: [{ label: 'signal', documentation: 'Signal to fire' }, { label: '...', documentation: 'Arguments to pass' }] },
  replicatesignal: { label: 'replicatesignal(signal, ...)', documentation: 'Replicates signal to server.', parameters: [{ label: 'signal', documentation: 'RBXScriptSignal to replicate' }, { label: '...', documentation: 'Arguments' }] },
  getcallbackvalue: { label: 'getcallbackvalue(object, property)', documentation: 'Gets callback property value.', parameters: [{ label: 'object', documentation: 'Instance to read from' }, { label: 'property', documentation: 'Callback property name' }] },

  readfile: { label: 'readfile(path)', documentation: 'Reads file contents from workspace folder.', parameters: [{ label: 'path', documentation: 'File path' }] },
  writefile: { label: 'writefile(path, content)', documentation: 'Writes to file in workspace folder.', parameters: [{ label: 'path', documentation: 'File path' }, { label: 'content', documentation: 'Content to write' }] },
  appendfile: { label: 'appendfile(path, content)', documentation: 'Appends to file in workspace folder.', parameters: [{ label: 'path', documentation: 'File path' }, { label: 'content', documentation: 'Content to append' }] },
  listfiles: { label: 'listfiles(path)', documentation: 'Lists files and folders in directory.', parameters: [{ label: 'path', documentation: 'Folder path' }] },
  makefolder: { label: 'makefolder(path)', documentation: 'Creates a new folder.', parameters: [{ label: 'path', documentation: 'Folder path' }] },

  fireclickdetector: { label: 'fireclickdetector(detector, distance?)', documentation: 'Fires a ClickDetector as if clicked.', parameters: [{ label: 'detector', documentation: 'ClickDetector to fire' }, { label: 'distance?', documentation: 'Distance from detector' }] },
  fireproximityprompt: { label: 'fireproximityprompt(prompt)', documentation: 'Fires a ProximityPrompt as if triggered.', parameters: [{ label: 'prompt', documentation: 'ProximityPrompt to fire' }] },
  firetouchinterest: { label: 'firetouchinterest(part1, part2, toggle)', documentation: 'Simulates touch between two parts.', parameters: [{ label: 'part1', documentation: 'First part' }, { label: 'part2', documentation: 'Second part' }, { label: 'toggle', documentation: '0=end, 1=start' }] },

  cleardrawcache: { label: 'cleardrawcache()', documentation: 'Removes all active Drawing objects.', parameters: [] },
  getrenderproperty: { label: 'getrenderproperty(drawing, property)', documentation: 'Gets Drawing property value.', parameters: [{ label: 'drawing', documentation: 'Drawing object' }, { label: 'property', documentation: 'Property name' }] },
  setrenderproperty: { label: 'setrenderproperty(drawing, property, value)', documentation: 'Sets Drawing property value.', parameters: [{ label: 'drawing', documentation: 'Drawing object' }, { label: 'property', documentation: 'Property name' }, { label: 'value', documentation: 'Value to set' }] },
  isrenderobj: { label: 'isrenderobj(object)', documentation: 'Checks if value is a Drawing object.', parameters: [{ label: 'object', documentation: 'Value to check' }] },
  isscriptable: { label: 'isscriptable(object, property)', documentation: 'Checks if property is scriptable.', parameters: [{ label: 'object', documentation: 'Instance' }, { label: 'property', documentation: 'Property name' }] },
  setscriptable: { label: 'setscriptable(instance, property, state)', documentation: 'Toggles property scriptability.', parameters: [{ label: 'instance', documentation: 'Instance' }, { label: 'property', documentation: 'Property name' }, { label: 'state', documentation: 'Scriptable state' }] },

  add_send_hook: { label: 'raknet.add_send_hook(hook)', documentation: 'Adds hook to raknet send, returns the hook.', parameters: [{ label: 'hook', documentation: '(message: RakNetMessage) -> ()' }] },
  remove_send_hook: { label: 'raknet.remove_send_hook(hook)', documentation: 'Removes hook from raknet send.', parameters: [{ label: 'hook', documentation: 'Hook to remove' }] },
  send: { label: 'raknet.send(data, priority?, reliability?, ordering_channel?)', documentation: 'Sends data over raknet.', parameters: [{ label: 'data', documentation: 'buffer|string|{number}' }, { label: 'priority?', documentation: 'Message priority' }, { label: 'reliability?', documentation: 'Message reliability' }, { label: 'ordering_channel?', documentation: 'Message ordering channel' }] },
  add_receive_hook: { label: 'raknet.add_receive_hook(hook)', documentation: 'Adds hook to raknet receive, returns the hook.', parameters: [{ label: 'hook', documentation: '(message: RakNetMessage) -> ()' }] },
  remove_receive_hook: { label: 'raknet.remove_receive_hook(hook)', documentation: 'Removes hook from raknet receive.', parameters: [{ label: 'hook', documentation: 'Hook to remove' }] },
  receive: { label: 'raknet.receive(data)', documentation: 'Receives data over raknet.', parameters: [{ label: 'data', documentation: 'buffer|string|{number}' }] },
};

function getWordAtPosition(model: Monaco.editor.ITextModel, position: Monaco.IPosition): { word: string; range: Monaco.IRange } | null {
  const wordInfo = model.getWordAtPosition(position);
  if (!wordInfo) return null;

  return {
    word: wordInfo.word,
    range: {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: wordInfo.startColumn,
      endColumn: wordInfo.endColumn,
    },
  };
}

function getLibraryAccess(model: Monaco.editor.ITextModel, position: Monaco.IPosition): { library: string; member: string } | null {
  const lineContent = model.getLineContent(position.lineNumber);
  const beforeCursor = lineContent.substring(0, position.column - 1);

  const match = beforeCursor.match(/(\w+)\.(\w*)$/);
  if (match) {
    return { library: match[1], member: match[2] };
  }

  const wordInfo = model.getWordAtPosition(position);
  if (wordInfo) {
    const fullBefore = lineContent.substring(0, wordInfo.startColumn - 1);
    const libMatch = fullBefore.match(/(\w+)\.$/);
    if (libMatch) {
      return { library: libMatch[1], member: wordInfo.word };
    }
  }

  return null;
}

export function registerLuauHoverProvider(monaco: typeof Monaco): Monaco.IDisposable {
  return monaco.languages.registerHoverProvider(LUAU_LANGUAGE_ID, {
    provideHover(model, position): Monaco.languages.ProviderResult<Monaco.languages.Hover> {
      const libAccess = getLibraryAccess(model, position);
      if (libAccess && LIBRARY_MEMBERS[libAccess.library]) {
        const memberInfo = LIBRARY_MEMBERS[libAccess.library][libAccess.member];
        if (memberInfo) {
          return {
            contents: [
              { value: `\`\`\`luau\n${memberInfo.signature || memberInfo.label}\n\`\`\`` },
              { value: memberInfo.documentation },
            ],
          };
        }
      }

      const wordInfo = getWordAtPosition(model, position);
      if (!wordInfo) return null;

      const info = HOVER_DATA[wordInfo.word];
      if (info) {
        return {
          range: wordInfo.range,
          contents: [
            { value: `\`\`\`luau\n${info.signature || info.label}\n\`\`\`` },
            { value: info.documentation },
          ],
        };
      }

      return null;
    },
  });
}

export function registerLuauSignatureHelpProvider(monaco: typeof Monaco): Monaco.IDisposable {
  return monaco.languages.registerSignatureHelpProvider(LUAU_LANGUAGE_ID, {
    signatureHelpTriggerCharacters: ['(', ','],
    signatureHelpRetriggerCharacters: [','],

    provideSignatureHelp(model, position): Monaco.languages.ProviderResult<Monaco.languages.SignatureHelpResult> {
      const lineContent = model.getLineContent(position.lineNumber);
      const beforeCursor = lineContent.substring(0, position.column - 1);

      let funcName = '';
      let paramIndex = 0;
      let depth = 0;

      for (let i = beforeCursor.length - 1; i >= 0; i--) {
        const char = beforeCursor[i];

        if (char === ')') depth++;
        else if (char === '(') {
          if (depth > 0) {
            depth--;
          } else {
            const beforeParen = beforeCursor.substring(0, i);
            const funcMatch = beforeParen.match(/(\w+)(?:\s*:\s*(\w+))?\s*$/);
            if (funcMatch) {
              funcName = funcMatch[2] || funcMatch[1];
            }
            break;
          }
        } else if (char === ',' && depth === 0) {
          paramIndex++;
        }
      }

      if (!funcName) return null;

      const sig = SIGNATURES[funcName];
      if (!sig) return null;

      return {
        value: {
          signatures: [{
            label: sig.label,
            documentation: sig.documentation,
            parameters: sig.parameters.map(p => ({
              label: p.label,
              documentation: p.documentation,
            })),
          }],
          activeSignature: 0,
          activeParameter: Math.min(paramIndex, sig.parameters.length - 1),
        },
        dispose: () => {},
      };
    },
  });
}

export function registerLuauLspProviders(monaco: typeof Monaco): Monaco.IDisposable[] {
  return [
    registerLuauHoverProvider(monaco),
    registerLuauSignatureHelpProvider(monaco),
  ];
}
