type MemberKind = 'property' | 'method' | 'event' | 'callback';

export interface ClassMember {
  name: string;
  kind: MemberKind;
  valueType?: string;
  args?: string;
  documentation: string;
}

interface RobloxClassDef {
  superclass?: string;
  members: ClassMember[];
}

const ROBLOX_CLASSES: Record<string, RobloxClassDef> = {
  Instance: {
    members: [
      { name: 'Name', kind: 'property', valueType: 'string', documentation: 'The name of the Instance' },
      { name: 'Parent', kind: 'property', valueType: 'Instance', documentation: 'The parent of the Instance' },
      { name: 'ClassName', kind: 'property', valueType: 'string', documentation: 'The class name of the Instance' },
      { name: 'FindFirstChild', kind: 'method', valueType: 'Instance', args: '${1:name}', documentation: 'Returns the first child with the given name, or nil' },
      { name: 'FindFirstChildOfClass', kind: 'method', valueType: 'Instance', args: '${1:className}', documentation: 'Returns the first child of the exact class' },
      { name: 'FindFirstChildWhichIsA', kind: 'method', valueType: 'Instance', args: '${1:className}', documentation: 'Returns the first child inheriting from the class' },
      { name: 'FindFirstAncestor', kind: 'method', valueType: 'Instance', args: '${1:name}', documentation: 'Returns the first ancestor with the given name' },
      { name: 'FindFirstAncestorOfClass', kind: 'method', valueType: 'Instance', args: '${1:className}', documentation: 'Returns the first ancestor of the exact class' },
      { name: 'WaitForChild', kind: 'method', valueType: 'Instance', args: '${1:name}', documentation: 'Yields until a child with the name exists' },
      { name: 'GetChildren', kind: 'method', valueType: '{Instance}', documentation: 'Returns an array of all direct children' },
      { name: 'GetDescendants', kind: 'method', valueType: '{Instance}', documentation: 'Returns an array of all descendants' },
      { name: 'IsA', kind: 'method', valueType: 'boolean', args: '${1:className}', documentation: 'Returns true if the instance inherits from the class' },
      { name: 'IsDescendantOf', kind: 'method', valueType: 'boolean', args: '${1:ancestor}', documentation: 'Returns true if this is a descendant of the ancestor' },
      { name: 'IsAncestorOf', kind: 'method', valueType: 'boolean', args: '${1:descendant}', documentation: 'Returns true if this is an ancestor of the descendant' },
      { name: 'Destroy', kind: 'method', documentation: 'Permanently destroys the instance and its descendants' },
      { name: 'Clone', kind: 'method', valueType: 'Instance', documentation: 'Creates a deep copy of the instance' },
      { name: 'GetAttribute', kind: 'method', args: '${1:name}', documentation: 'Returns the value of the named attribute' },
      { name: 'SetAttribute', kind: 'method', args: '${1:name}, ${2:value}', documentation: 'Sets the value of the named attribute' },
      { name: 'GetAttributes', kind: 'method', valueType: 'table', documentation: 'Returns a dictionary of all attributes' },
      { name: 'GetPropertyChangedSignal', kind: 'method', valueType: 'RBXScriptSignal', args: '${1:property}', documentation: 'Returns a signal that fires when the property changes' },
      { name: 'GetFullName', kind: 'method', valueType: 'string', documentation: 'Returns the full hierarchy path' },
      { name: 'ChildAdded', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when a child is added' },
      { name: 'ChildRemoved', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when a child is removed' },
      { name: 'Destroying', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when the instance is being destroyed' },
      { name: 'Changed', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when a property changes' },
    ],
  },
  BasePart: {
    superclass: 'Instance',
    members: [
      { name: 'Position', kind: 'property', valueType: 'Vector3', documentation: 'The position in 3D space' },
      { name: 'CFrame', kind: 'property', valueType: 'CFrame', documentation: 'The coordinate frame (position + rotation)' },
      { name: 'Size', kind: 'property', valueType: 'Vector3', documentation: 'The size of the part' },
      { name: 'Anchored', kind: 'property', valueType: 'boolean', documentation: 'Whether the part is immovable by physics' },
      { name: 'CanCollide', kind: 'property', valueType: 'boolean', documentation: 'Whether other parts can collide with this' },
      { name: 'CanQuery', kind: 'property', valueType: 'boolean', documentation: 'Whether raycasts can hit this part' },
      { name: 'CanTouch', kind: 'property', valueType: 'boolean', documentation: 'Whether touch events fire for this part' },
      { name: 'Transparency', kind: 'property', valueType: 'number', documentation: 'How transparent the part is (0-1)' },
      { name: 'Color', kind: 'property', valueType: 'Color3', documentation: 'The color of the part' },
      { name: 'BrickColor', kind: 'property', valueType: 'BrickColor', documentation: 'The BrickColor of the part' },
      { name: 'Material', kind: 'property', valueType: 'Enum.Material', documentation: 'The material of the part' },
      { name: 'Orientation', kind: 'property', valueType: 'Vector3', documentation: 'The rotation in degrees' },
      { name: 'Velocity', kind: 'property', valueType: 'Vector3', documentation: 'The velocity of the part' },
      { name: 'AssemblyLinearVelocity', kind: 'property', valueType: 'Vector3', documentation: 'Linear velocity of the assembly' },
      { name: 'AssemblyAngularVelocity', kind: 'property', valueType: 'Vector3', documentation: 'Angular velocity of the assembly' },
      { name: 'Massless', kind: 'property', valueType: 'boolean', documentation: 'Whether the part contributes to assembly mass' },
      { name: 'GetTouchingParts', kind: 'method', valueType: '{BasePart}', documentation: 'Returns parts touching this part' },
      { name: 'SetNetworkOwner', kind: 'method', args: '${1:player}', documentation: 'Sets the network owner of the part' },
      { name: 'Touched', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when another part touches this part' },
      { name: 'TouchEnded', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when a touch ends' },
    ],
  },
  Part: { superclass: 'BasePart', members: [
    { name: 'Shape', kind: 'property', valueType: 'Enum.PartType', documentation: 'The shape of the part (Block, Ball, Cylinder, Wedge)' },
  ]},
  MeshPart: { superclass: 'BasePart', members: [
    { name: 'MeshId', kind: 'property', valueType: 'string', documentation: 'The asset ID of the mesh' },
    { name: 'TextureID', kind: 'property', valueType: 'string', documentation: 'The texture applied to the mesh' },
  ]},
  Model: {
    superclass: 'Instance',
    members: [
      { name: 'PrimaryPart', kind: 'property', valueType: 'BasePart', documentation: 'The primary part used for movement' },
      { name: 'WorldPivot', kind: 'property', valueType: 'CFrame', documentation: 'The pivot point in world space' },
      { name: 'GetBoundingBox', kind: 'method', valueType: 'CFrame', documentation: 'Returns the CFrame and size of the bounding box' },
      { name: 'GetExtentsSize', kind: 'method', valueType: 'Vector3', documentation: 'Returns the size of the bounding box' },
      { name: 'MoveTo', kind: 'method', args: '${1:position}', documentation: 'Moves the model so PrimaryPart is at position' },
      { name: 'PivotTo', kind: 'method', args: '${1:cframe}', documentation: 'Moves the model to the given CFrame pivot' },
      { name: 'GetPivot', kind: 'method', valueType: 'CFrame', documentation: 'Returns the current pivot CFrame' },
    ],
  },
  Humanoid: {
    superclass: 'Instance',
    members: [
      { name: 'Health', kind: 'property', valueType: 'number', documentation: 'Current health points' },
      { name: 'MaxHealth', kind: 'property', valueType: 'number', documentation: 'Maximum health points' },
      { name: 'WalkSpeed', kind: 'property', valueType: 'number', documentation: 'Walking speed (default 16)' },
      { name: 'JumpPower', kind: 'property', valueType: 'number', documentation: 'Jump power (legacy, default 50)' },
      { name: 'JumpHeight', kind: 'property', valueType: 'number', documentation: 'Jump height in studs' },
      { name: 'HipHeight', kind: 'property', valueType: 'number', documentation: 'Height of the hip from the ground' },
      { name: 'AutoRotate', kind: 'property', valueType: 'boolean', documentation: 'Whether the character auto-rotates to face movement direction' },
      { name: 'RigType', kind: 'property', valueType: 'Enum.HumanoidRigType', documentation: 'R6 or R15 rig type' },
      { name: 'FloorMaterial', kind: 'property', valueType: 'Enum.Material', documentation: 'Material the humanoid is standing on' },
      { name: 'MoveDirection', kind: 'property', valueType: 'Vector3', documentation: 'Current movement direction' },
      { name: 'Sit', kind: 'property', valueType: 'boolean', documentation: 'Whether the humanoid is sitting' },
      { name: 'SeatPart', kind: 'property', valueType: 'BasePart', documentation: 'The seat the humanoid is sitting in' },
      { name: 'RootPart', kind: 'property', valueType: 'BasePart', documentation: 'The root part of the character' },
      { name: 'MoveTo', kind: 'method', args: '${1:position}', documentation: 'Makes the humanoid walk toward a position' },
      { name: 'TakeDamage', kind: 'method', args: '${1:amount}', documentation: 'Reduces health by amount' },
      { name: 'EquipTool', kind: 'method', args: '${1:tool}', documentation: 'Equips a tool from the backpack' },
      { name: 'UnequipTools', kind: 'method', documentation: 'Unequips all tools' },
      { name: 'ChangeState', kind: 'method', args: '${1:state}', documentation: 'Changes the humanoid state' },
      { name: 'GetState', kind: 'method', valueType: 'Enum.HumanoidStateType', documentation: 'Returns current state' },
      { name: 'AddAccessory', kind: 'method', args: '${1:accessory}', documentation: 'Attaches an accessory' },
      { name: 'Died', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when health reaches 0' },
      { name: 'Running', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires each frame while running' },
      { name: 'Jumping', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when the humanoid jumps' },
      { name: 'Seated', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when the humanoid sits or stands' },
      { name: 'StateChanged', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when the humanoid state changes' },
      { name: 'MoveToFinished', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when MoveTo reaches the goal or times out' },
      { name: 'HealthChanged', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when health changes' },
      { name: 'Touched', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when any limb touches a part' },
    ],
  },
  Player: {
    superclass: 'Instance',
    members: [
      { name: 'Character', kind: 'property', valueType: 'Model', documentation: 'The player\'s character model' },
      { name: 'UserId', kind: 'property', valueType: 'number', documentation: 'Unique numeric player ID' },
      { name: 'DisplayName', kind: 'property', valueType: 'string', documentation: 'The player\'s display name' },
      { name: 'Team', kind: 'property', valueType: 'Team', documentation: 'The player\'s team' },
      { name: 'AccountAge', kind: 'property', valueType: 'number', documentation: 'Account age in days' },
      { name: 'PlayerGui', kind: 'property', valueType: 'PlayerGui', documentation: 'Container for player GUI elements' },
      { name: 'Backpack', kind: 'property', valueType: 'Backpack', documentation: 'Container for player tools' },
      { name: 'Kick', kind: 'method', args: '${1:message}', documentation: 'Kicks the player from the server' },
      { name: 'LoadCharacter', kind: 'method', documentation: 'Respawns the player\'s character' },
      { name: 'GetMouse', kind: 'method', valueType: 'Mouse', documentation: 'Returns the player\'s Mouse object (client only)' },
      { name: 'IsFriendsWith', kind: 'method', valueType: 'boolean', args: '${1:userId}', documentation: 'Returns whether the player is friends with another user' },
      { name: 'CharacterAdded', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when a new character spawns' },
      { name: 'CharacterRemoving', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when the character is being removed' },
      { name: 'Chatted', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when the player sends a chat message' },
    ],
  },
  Players: {
    superclass: 'Instance',
    members: [
      { name: 'LocalPlayer', kind: 'property', valueType: 'Player', documentation: 'The local player (client only)' },
      { name: 'MaxPlayers', kind: 'property', valueType: 'number', documentation: 'Maximum number of players' },
      { name: 'GetPlayers', kind: 'method', valueType: '{Player}', documentation: 'Returns an array of all players' },
      { name: 'GetPlayerFromCharacter', kind: 'method', valueType: 'Player', args: '${1:character}', documentation: 'Returns the Player from a character model' },
      { name: 'GetPlayerByUserId', kind: 'method', valueType: 'Player', args: '${1:userId}', documentation: 'Returns the Player with the given UserId' },
      { name: 'PlayerAdded', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when a player joins the server' },
      { name: 'PlayerRemoving', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when a player is leaving the server' },
    ],
  },
  Workspace: {
    superclass: 'Instance',
    members: [
      { name: 'CurrentCamera', kind: 'property', valueType: 'Camera', documentation: 'The current active camera' },
      { name: 'Gravity', kind: 'property', valueType: 'number', documentation: 'Gravity acceleration (default 196.2)' },
      { name: 'DistributedGameTime', kind: 'property', valueType: 'number', documentation: 'Time since the game started' },
      { name: 'Terrain', kind: 'property', valueType: 'Terrain', documentation: 'The Terrain object' },
      { name: 'Raycast', kind: 'method', valueType: 'RaycastResult', args: '${1:origin}, ${2:direction}, ${3:params}', documentation: 'Casts a ray and returns the result' },
      { name: 'GetServerTimeNow', kind: 'method', valueType: 'number', documentation: 'Returns the current server time' },
    ],
  },
  Camera: {
    superclass: 'Instance',
    members: [
      { name: 'CFrame', kind: 'property', valueType: 'CFrame', documentation: 'The camera\'s position and rotation' },
      { name: 'CameraType', kind: 'property', valueType: 'Enum.CameraType', documentation: 'The camera mode (Custom, Scriptable, etc.)' },
      { name: 'FieldOfView', kind: 'property', valueType: 'number', documentation: 'Field of view in degrees (default 70)' },
      { name: 'Focus', kind: 'property', valueType: 'CFrame', documentation: 'The focus point for depth of field' },
      { name: 'ViewportSize', kind: 'property', valueType: 'Vector2', documentation: 'The viewport dimensions in pixels' },
      { name: 'CameraSubject', kind: 'property', valueType: 'Instance', documentation: 'The subject the camera follows' },
      { name: 'ScreenPointToRay', kind: 'method', valueType: 'Ray', args: '${1:x}, ${2:y}', documentation: 'Creates a ray from screen coordinates' },
      { name: 'ViewportPointToRay', kind: 'method', valueType: 'Ray', args: '${1:x}, ${2:y}', documentation: 'Creates a ray from viewport coordinates' },
      { name: 'WorldToScreenPoint', kind: 'method', args: '${1:worldPoint}', documentation: 'Converts world point to screen coordinates' },
      { name: 'WorldToViewportPoint', kind: 'method', args: '${1:worldPoint}', documentation: 'Converts world point to viewport coordinates' },
    ],
  },
  TweenService: { superclass: 'Instance', members: [
    { name: 'Create', kind: 'method', valueType: 'Tween', args: '${1:instance}, ${2:tweenInfo}, ${3:goals}', documentation: 'Creates a new Tween' },
    { name: 'GetValue', kind: 'method', valueType: 'number', args: '${1:alpha}, ${2:easingStyle}, ${3:easingDirection}', documentation: 'Returns the easing value for alpha' },
  ]},
  Tween: { superclass: 'Instance', members: [
    { name: 'PlaybackState', kind: 'property', valueType: 'Enum.PlaybackState', documentation: 'Current playback state' },
    { name: 'Play', kind: 'method', documentation: 'Starts playing the tween' },
    { name: 'Pause', kind: 'method', documentation: 'Pauses the tween' },
    { name: 'Cancel', kind: 'method', documentation: 'Cancels the tween' },
    { name: 'Completed', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when the tween finishes' },
  ]},
  RunService: { superclass: 'Instance', members: [
    { name: 'IsClient', kind: 'method', valueType: 'boolean', documentation: 'Returns true if running on client' },
    { name: 'IsServer', kind: 'method', valueType: 'boolean', documentation: 'Returns true if running on server' },
    { name: 'IsStudio', kind: 'method', valueType: 'boolean', documentation: 'Returns true if running in Studio' },
    { name: 'IsRunning', kind: 'method', valueType: 'boolean', documentation: 'Returns true if the game is running' },
    { name: 'BindToRenderStep', kind: 'method', args: '${1:name}, ${2:priority}, ${3:func}', documentation: 'Binds a function to run each render frame' },
    { name: 'UnbindFromRenderStep', kind: 'method', args: '${1:name}', documentation: 'Unbinds a render step function' },
    { name: 'Heartbeat', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires every frame after physics (server + client)' },
    { name: 'RenderStepped', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires every frame before rendering (client only)' },
    { name: 'Stepped', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires every frame before physics' },
  ]},
  UserInputService: { superclass: 'Instance', members: [
    { name: 'MouseBehavior', kind: 'property', valueType: 'Enum.MouseBehavior', documentation: 'Controls mouse lock behavior' },
    { name: 'MouseIconEnabled', kind: 'property', valueType: 'boolean', documentation: 'Whether the mouse icon is visible' },
    { name: 'MouseEnabled', kind: 'property', valueType: 'boolean', documentation: 'Whether the device has a mouse' },
    { name: 'KeyboardEnabled', kind: 'property', valueType: 'boolean', documentation: 'Whether the device has a keyboard' },
    { name: 'TouchEnabled', kind: 'property', valueType: 'boolean', documentation: 'Whether the device has touch' },
    { name: 'GamepadEnabled', kind: 'property', valueType: 'boolean', documentation: 'Whether a gamepad is connected' },
    { name: 'GetMouseLocation', kind: 'method', valueType: 'Vector2', documentation: 'Returns the mouse position on screen' },
    { name: 'IsKeyDown', kind: 'method', valueType: 'boolean', args: '${1:keyCode}', documentation: 'Returns true if the key is pressed' },
    { name: 'IsMouseButtonPressed', kind: 'method', valueType: 'boolean', args: '${1:mouseButton}', documentation: 'Returns true if mouse button is pressed' },
    { name: 'GetKeysPressed', kind: 'method', valueType: 'table', documentation: 'Returns all currently pressed keys' },
    { name: 'GetFocusedTextBox', kind: 'method', valueType: 'TextBox', documentation: 'Returns the currently focused TextBox' },
    { name: 'InputBegan', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when an input begins (key press, mouse click, etc.)' },
    { name: 'InputEnded', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when an input ends' },
    { name: 'InputChanged', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when an input value changes (mouse move, etc.)' },
  ]},
  HttpService: { superclass: 'Instance', members: [
    { name: 'JSONEncode', kind: 'method', valueType: 'string', args: '${1:value}', documentation: 'Encodes a value to JSON string' },
    { name: 'JSONDecode', kind: 'method', args: '${1:json}', documentation: 'Decodes a JSON string to a value' },
    { name: 'GenerateGUID', kind: 'method', valueType: 'string', args: '${1:wrapInCurlyBraces}', documentation: 'Generates a unique identifier string' },
    { name: 'UrlEncode', kind: 'method', valueType: 'string', args: '${1:input}', documentation: 'URL-encodes a string' },
    { name: 'GetAsync', kind: 'method', valueType: 'string', args: '${1:url}', documentation: 'Performs an HTTP GET request' },
    { name: 'PostAsync', kind: 'method', valueType: 'string', args: '${1:url}, ${2:data}', documentation: 'Performs an HTTP POST request' },
    { name: 'RequestAsync', kind: 'method', valueType: 'table', args: '${1:options}', documentation: 'Performs an HTTP request with full options' },
  ]},
  ReplicatedStorage: { superclass: 'Instance', members: [] },
  ServerStorage: { superclass: 'Instance', members: [] },
  ServerScriptService: { superclass: 'Instance', members: [] },
  DataStoreService: { superclass: 'Instance', members: [
    { name: 'GetDataStore', kind: 'method', valueType: 'DataStore', args: '${1:name}, ${2:scope}', documentation: 'Returns a DataStore with the given name' },
    { name: 'GetGlobalDataStore', kind: 'method', valueType: 'DataStore', documentation: 'Returns the default global DataStore' },
    { name: 'GetOrderedDataStore', kind: 'method', valueType: 'OrderedDataStore', args: '${1:name}, ${2:scope}', documentation: 'Returns an OrderedDataStore' },
  ]},
  CollectionService: { superclass: 'Instance', members: [
    { name: 'AddTag', kind: 'method', args: '${1:instance}, ${2:tag}', documentation: 'Adds a tag to an instance' },
    { name: 'RemoveTag', kind: 'method', args: '${1:instance}, ${2:tag}', documentation: 'Removes a tag from an instance' },
    { name: 'HasTag', kind: 'method', valueType: 'boolean', args: '${1:instance}, ${2:tag}', documentation: 'Returns true if the instance has the tag' },
    { name: 'GetTagged', kind: 'method', valueType: '{Instance}', args: '${1:tag}', documentation: 'Returns all instances with the tag' },
    { name: 'GetTags', kind: 'method', valueType: '{string}', args: '${1:instance}', documentation: 'Returns all tags on an instance' },
    { name: 'GetInstanceAddedSignal', kind: 'method', valueType: 'RBXScriptSignal', args: '${1:tag}', documentation: 'Returns a signal for when tagged instances are added' },
    { name: 'GetInstanceRemovedSignal', kind: 'method', valueType: 'RBXScriptSignal', args: '${1:tag}', documentation: 'Returns a signal for when tagged instances are removed' },
  ]},
  Lighting: { superclass: 'Instance', members: [
    { name: 'Ambient', kind: 'property', valueType: 'Color3', documentation: 'Ambient light color' },
    { name: 'Brightness', kind: 'property', valueType: 'number', documentation: 'Light brightness intensity' },
    { name: 'ClockTime', kind: 'property', valueType: 'number', documentation: 'Time of day in hours (0-24)' },
    { name: 'TimeOfDay', kind: 'property', valueType: 'string', documentation: 'Time of day as HH:MM:SS string' },
    { name: 'FogColor', kind: 'property', valueType: 'Color3', documentation: 'Color of the fog' },
    { name: 'FogEnd', kind: 'property', valueType: 'number', documentation: 'Distance where fog is fully opaque' },
    { name: 'FogStart', kind: 'property', valueType: 'number', documentation: 'Distance where fog begins' },
    { name: 'GlobalShadows', kind: 'property', valueType: 'boolean', documentation: 'Whether global shadows are enabled' },
    { name: 'LightingChanged', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when a lighting property changes' },
  ]},
  SoundService: { superclass: 'Instance', members: [
    { name: 'AmbientReverb', kind: 'property', valueType: 'Enum.ReverbType', documentation: 'The global reverb type' },
    { name: 'DistanceFactor', kind: 'property', valueType: 'number', documentation: 'Scale factor for 3D sound distance' },
    { name: 'DopplerScale', kind: 'property', valueType: 'number', documentation: 'Scale of the Doppler effect' },
    { name: 'RolloffScale', kind: 'property', valueType: 'number', documentation: 'Scale of volume rolloff' },
  ]},
  Sound: { superclass: 'Instance', members: [
    { name: 'SoundId', kind: 'property', valueType: 'string', documentation: 'The asset ID of the sound' },
    { name: 'Volume', kind: 'property', valueType: 'number', documentation: 'Volume level (0-10, default 0.5)' },
    { name: 'PlaybackSpeed', kind: 'property', valueType: 'number', documentation: 'Playback speed multiplier' },
    { name: 'Looped', kind: 'property', valueType: 'boolean', documentation: 'Whether the sound loops' },
    { name: 'Playing', kind: 'property', valueType: 'boolean', documentation: 'Whether the sound is currently playing' },
    { name: 'IsPlaying', kind: 'property', valueType: 'boolean', documentation: 'Read-only playing state' },
    { name: 'TimePosition', kind: 'property', valueType: 'number', documentation: 'Current playback position in seconds' },
    { name: 'TimeLength', kind: 'property', valueType: 'number', documentation: 'Total duration in seconds' },
    { name: 'Play', kind: 'method', documentation: 'Plays the sound from the beginning' },
    { name: 'Stop', kind: 'method', documentation: 'Stops the sound' },
    { name: 'Pause', kind: 'method', documentation: 'Pauses the sound' },
    { name: 'Resume', kind: 'method', documentation: 'Resumes from pause' },
    { name: 'Played', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when the sound starts playing' },
    { name: 'Stopped', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when the sound stops' },
    { name: 'Ended', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when the sound finishes' },
  ]},
  GuiObject: {
    superclass: 'Instance',
    members: [
      { name: 'Position', kind: 'property', valueType: 'UDim2', documentation: 'Position of the GUI element' },
      { name: 'Size', kind: 'property', valueType: 'UDim2', documentation: 'Size of the GUI element' },
      { name: 'AnchorPoint', kind: 'property', valueType: 'Vector2', documentation: 'Anchor point for positioning (0-1)' },
      { name: 'Rotation', kind: 'property', valueType: 'number', documentation: 'Rotation in degrees' },
      { name: 'BackgroundColor3', kind: 'property', valueType: 'Color3', documentation: 'Background color' },
      { name: 'BackgroundTransparency', kind: 'property', valueType: 'number', documentation: 'Background transparency (0-1)' },
      { name: 'BorderColor3', kind: 'property', valueType: 'Color3', documentation: 'Border color' },
      { name: 'BorderSizePixel', kind: 'property', valueType: 'number', documentation: 'Border thickness in pixels' },
      { name: 'Visible', kind: 'property', valueType: 'boolean', documentation: 'Whether the element is visible' },
      { name: 'ZIndex', kind: 'property', valueType: 'number', documentation: 'Draw order (higher = on top)' },
      { name: 'LayoutOrder', kind: 'property', valueType: 'number', documentation: 'Order for layout controllers' },
      { name: 'ClipsDescendants', kind: 'property', valueType: 'boolean', documentation: 'Whether to clip children outside bounds' },
      { name: 'Active', kind: 'property', valueType: 'boolean', documentation: 'Whether the element sinks input' },
      { name: 'AutomaticSize', kind: 'property', valueType: 'Enum.AutomaticSize', documentation: 'Automatic sizing behavior' },
      { name: 'TweenPosition', kind: 'method', args: '${1:endPosition}, ${2:easingDirection}, ${3:easingStyle}, ${4:time}', documentation: 'Animates the position' },
      { name: 'TweenSize', kind: 'method', args: '${1:endSize}, ${2:easingDirection}, ${3:easingStyle}, ${4:time}', documentation: 'Animates the size' },
      { name: 'MouseEnter', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when mouse enters the element' },
      { name: 'MouseLeave', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when mouse leaves the element' },
      { name: 'InputBegan', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when input begins on this element' },
      { name: 'InputEnded', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when input ends on this element' },
    ],
  },
  Frame: { superclass: 'GuiObject', members: [] },
  TextLabel: { superclass: 'GuiObject', members: [
    { name: 'Text', kind: 'property', valueType: 'string', documentation: 'The displayed text' },
    { name: 'TextColor3', kind: 'property', valueType: 'Color3', documentation: 'Text color' },
    { name: 'TextSize', kind: 'property', valueType: 'number', documentation: 'Font size in pixels' },
    { name: 'Font', kind: 'property', valueType: 'Enum.Font', documentation: 'The font family' },
    { name: 'TextScaled', kind: 'property', valueType: 'boolean', documentation: 'Whether text auto-scales to fit' },
    { name: 'TextWrapped', kind: 'property', valueType: 'boolean', documentation: 'Whether text wraps to new lines' },
    { name: 'TextXAlignment', kind: 'property', valueType: 'Enum.TextXAlignment', documentation: 'Horizontal text alignment' },
    { name: 'TextYAlignment', kind: 'property', valueType: 'Enum.TextYAlignment', documentation: 'Vertical text alignment' },
    { name: 'TextTransparency', kind: 'property', valueType: 'number', documentation: 'Text transparency (0-1)' },
    { name: 'RichText', kind: 'property', valueType: 'boolean', documentation: 'Whether rich text markup is enabled' },
    { name: 'MaxVisibleGraphemes', kind: 'property', valueType: 'number', documentation: 'Max visible characters (-1 = all)' },
    { name: 'ContentText', kind: 'property', valueType: 'string', documentation: 'The text with rich text tags stripped' },
    { name: 'TextBounds', kind: 'property', valueType: 'Vector2', documentation: 'The size of the rendered text' },
  ]},
  TextButton: { superclass: 'GuiObject', members: [
    { name: 'Text', kind: 'property', valueType: 'string', documentation: 'The button text' },
    { name: 'TextColor3', kind: 'property', valueType: 'Color3', documentation: 'Text color' },
    { name: 'TextSize', kind: 'property', valueType: 'number', documentation: 'Font size in pixels' },
    { name: 'Font', kind: 'property', valueType: 'Enum.Font', documentation: 'The font family' },
    { name: 'TextScaled', kind: 'property', valueType: 'boolean', documentation: 'Whether text auto-scales' },
    { name: 'MouseButton1Click', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires on left mouse click' },
    { name: 'MouseButton1Down', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires on left mouse press' },
    { name: 'Activated', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when activated (click or touch)' },
  ]},
  ImageLabel: { superclass: 'GuiObject', members: [
    { name: 'Image', kind: 'property', valueType: 'string', documentation: 'The image asset ID' },
    { name: 'ImageColor3', kind: 'property', valueType: 'Color3', documentation: 'Image tint color' },
    { name: 'ImageTransparency', kind: 'property', valueType: 'number', documentation: 'Image transparency (0-1)' },
    { name: 'ScaleType', kind: 'property', valueType: 'Enum.ScaleType', documentation: 'How the image scales (Stretch, Slice, Tile, Fit, Crop)' },
  ]},
  ImageButton: { superclass: 'GuiObject', members: [
    { name: 'Image', kind: 'property', valueType: 'string', documentation: 'The image asset ID' },
    { name: 'ImageColor3', kind: 'property', valueType: 'Color3', documentation: 'Image tint color' },
    { name: 'ImageTransparency', kind: 'property', valueType: 'number', documentation: 'Image transparency (0-1)' },
    { name: 'MouseButton1Click', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires on left mouse click' },
    { name: 'Activated', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when activated' },
  ]},
  ScrollingFrame: { superclass: 'GuiObject', members: [
    { name: 'CanvasSize', kind: 'property', valueType: 'UDim2', documentation: 'The size of the scrollable area' },
    { name: 'CanvasPosition', kind: 'property', valueType: 'Vector2', documentation: 'Current scroll position' },
    { name: 'ScrollBarThickness', kind: 'property', valueType: 'number', documentation: 'Width of the scrollbar' },
    { name: 'ScrollingDirection', kind: 'property', valueType: 'Enum.ScrollingDirection', documentation: 'Allowed scroll directions' },
    { name: 'AutomaticCanvasSize', kind: 'property', valueType: 'Enum.AutomaticSize', documentation: 'Auto-sizing for canvas' },
  ]},
  ScreenGui: { superclass: 'Instance', members: [
    { name: 'Enabled', kind: 'property', valueType: 'boolean', documentation: 'Whether the GUI is visible' },
    { name: 'DisplayOrder', kind: 'property', valueType: 'number', documentation: 'Draw order among ScreenGuis' },
    { name: 'IgnoreGuiInset', kind: 'property', valueType: 'boolean', documentation: 'Whether to ignore the top bar inset' },
    { name: 'ResetOnSpawn', kind: 'property', valueType: 'boolean', documentation: 'Whether the GUI resets on respawn' },
    { name: 'ZIndexBehavior', kind: 'property', valueType: 'Enum.ZIndexBehavior', documentation: 'How ZIndex works (Global or Sibling)' },
  ]},
  RemoteEvent: { superclass: 'Instance', members: [
    { name: 'FireServer', kind: 'method', args: '${1:...}', documentation: 'Fires the event to the server (client only)' },
    { name: 'FireClient', kind: 'method', args: '${1:player}, ${2:...}', documentation: 'Fires the event to a specific client (server only)' },
    { name: 'FireAllClients', kind: 'method', args: '${1:...}', documentation: 'Fires the event to all clients (server only)' },
    { name: 'OnServerEvent', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Server-side event handler' },
    { name: 'OnClientEvent', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Client-side event handler' },
  ]},
  RemoteFunction: { superclass: 'Instance', members: [
    { name: 'InvokeServer', kind: 'method', args: '${1:...}', documentation: 'Invokes the function on the server (client only)' },
    { name: 'InvokeClient', kind: 'method', args: '${1:player}, ${2:...}', documentation: 'Invokes the function on a client (server only)' },
    { name: 'OnServerInvoke', kind: 'callback', documentation: 'Server-side callback to assign' },
    { name: 'OnClientInvoke', kind: 'callback', documentation: 'Client-side callback to assign' },
  ]},
  BindableEvent: { superclass: 'Instance', members: [
    { name: 'Fire', kind: 'method', args: '${1:...}', documentation: 'Fires the event to all connected handlers' },
    { name: 'Event', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'The signal to connect to' },
  ]},
  Tool: { superclass: 'Instance', members: [
    { name: 'Enabled', kind: 'property', valueType: 'boolean', documentation: 'Whether the tool can be used' },
    { name: 'CanBeDropped', kind: 'property', valueType: 'boolean', documentation: 'Whether the tool can be dropped' },
    { name: 'RequiresHandle', kind: 'property', valueType: 'boolean', documentation: 'Whether a Handle part is required' },
    { name: 'ToolTip', kind: 'property', valueType: 'string', documentation: 'Tooltip text shown on hover' },
    { name: 'Activated', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when the tool is activated (clicked)' },
    { name: 'Deactivated', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when the tool is deactivated' },
    { name: 'Equipped', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when the tool is equipped' },
    { name: 'Unequipped', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when the tool is unequipped' },
  ]},
  AnimationTrack: { superclass: 'Instance', members: [
    { name: 'IsPlaying', kind: 'property', valueType: 'boolean', documentation: 'Whether the animation is playing' },
    { name: 'Length', kind: 'property', valueType: 'number', documentation: 'Duration of the animation' },
    { name: 'Looped', kind: 'property', valueType: 'boolean', documentation: 'Whether the animation loops' },
    { name: 'Priority', kind: 'property', valueType: 'Enum.AnimationPriority', documentation: 'Animation priority level' },
    { name: 'Speed', kind: 'property', valueType: 'number', documentation: 'Playback speed multiplier' },
    { name: 'TimePosition', kind: 'property', valueType: 'number', documentation: 'Current position in the animation' },
    { name: 'WeightCurrent', kind: 'property', valueType: 'number', documentation: 'Current blend weight' },
    { name: 'Play', kind: 'method', args: '${1:fadeTime}, ${2:weight}, ${3:speed}', documentation: 'Plays the animation' },
    { name: 'Stop', kind: 'method', args: '${1:fadeTime}', documentation: 'Stops the animation' },
    { name: 'AdjustSpeed', kind: 'method', args: '${1:speed}', documentation: 'Adjusts playback speed' },
    { name: 'AdjustWeight', kind: 'method', args: '${1:weight}, ${2:fadeTime}', documentation: 'Adjusts blend weight' },
    { name: 'Stopped', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when the animation stops' },
    { name: 'KeyframeReached', kind: 'event', valueType: 'RBXScriptSignal', documentation: 'Fires when a named keyframe is reached' },
  ]},
};

const SERVICE_CLASS_MAP: Record<string, string> = {
  Players: 'Players',
  Workspace: 'Workspace',
  TweenService: 'TweenService',
  RunService: 'RunService',
  UserInputService: 'UserInputService',
  HttpService: 'HttpService',
  ReplicatedStorage: 'ReplicatedStorage',
  ReplicatedFirst: 'ReplicatedStorage',
  ServerStorage: 'ServerStorage',
  ServerScriptService: 'ServerScriptService',
  StarterGui: 'Instance',
  StarterPack: 'Instance',
  StarterPlayer: 'Instance',
  Lighting: 'Lighting',
  SoundService: 'SoundService',
  ContextActionService: 'Instance',
  MarketplaceService: 'Instance',
  DataStoreService: 'DataStoreService',
  MessagingService: 'Instance',
  TeleportService: 'Instance',
  TextService: 'Instance',
  PathfindingService: 'Instance',
  PhysicsService: 'Instance',
  CollectionService: 'CollectionService',
  Debris: 'Instance',
  Chat: 'Instance',
  Teams: 'Instance',
  MemoryStoreService: 'Instance',
};

const EVENT_PARAM_NAMES: Record<string, string[]> = {
  PlayerAdded: ['player'],
  PlayerRemoving: ['player'],
  CharacterAdded: ['character'],
  CharacterRemoving: ['character'],
  ChildAdded: ['child'],
  ChildRemoved: ['child'],
  Touched: ['otherPart'],
  TouchEnded: ['otherPart'],
  InputBegan: ['input', 'gameProcessed'],
  InputEnded: ['input', 'gameProcessed'],
  InputChanged: ['input', 'gameProcessed'],
  Chatted: ['message', 'recipient'],
  Heartbeat: ['deltaTime'],
  RenderStepped: ['deltaTime'],
  Stepped: ['time', 'deltaTime'],
  Died: [],
  Seated: ['active', 'seat'],
  StateChanged: ['oldState', 'newState'],
  HealthChanged: ['health'],
  MoveToFinished: ['reached'],
  MouseButton1Click: [],
  Activated: [],
  Equipped: ['mouse'],
  Unequipped: [],
  Completed: ['playbackState'],
  OnServerEvent: ['player'],
  OnClientEvent: [],
  Changed: ['property'],
  Destroying: [],
  MouseEnter: ['x', 'y'],
  MouseLeave: ['x', 'y'],
  LightingChanged: ['skyboxChanged'],
  Played: ['soundId'],
  Stopped: ['soundId'],
  Ended: ['soundId'],
  KeyframeReached: ['keyframeName'],
};

export function getClassMembers(className: string): ClassMember[] {
  const members: ClassMember[] = [];
  const visited = new Set<string>();
  let current: string | undefined = className;

  while (current && !visited.has(current)) {
    visited.add(current);
    const classDef: RobloxClassDef | undefined = ROBLOX_CLASSES[current];
    if (classDef) {
      members.push(...classDef.members);
      current = classDef.superclass;
    } else {
      break;
    }
  }

  return members;
}

export function getMemberValueType(className: string, memberName: string): string | null {
  const members = getClassMembers(className);
  const member = members.find(m => m.name === memberName);
  return member?.valueType ?? null;
}

export function isKnownClass(name: string): boolean {
  return name in ROBLOX_CLASSES;
}

export function getServiceClassName(serviceName: string): string | null {
  return SERVICE_CLASS_MAP[serviceName] ?? null;
}

export function getEventParamNames(eventName: string): string[] | null {
  return EVENT_PARAM_NAMES[eventName] ?? null;
}

export function getAllClassNames(): string[] {
  return Object.keys(ROBLOX_CLASSES);
}
