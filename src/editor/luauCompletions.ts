import type * as Monaco from 'monaco-editor';
import { LUAU_LANGUAGE_ID } from './luauLanguage';
import { getNGramSuggestions, NGramConfig } from './luauNGram';
import { getClassMembers, isKnownClass, getEventParamNames, ClassMember } from './completions/robloxClasses';
import { analyzeScope, resolveChainType } from './completions/scopeAnalyzer';
import { recordUsage, getUsageBoost } from './completions/usageTracker';

interface CompletionItem {
  label: string;
  kind: Monaco.languages.CompletionItemKind;
  insertText: string;
  detail?: string;
  documentation?: string;
  insertTextRules?: Monaco.languages.CompletionItemInsertTextRule;
  sortText?: string;
  filterText?: string;
}

const NGRAM_CONFIG: NGramConfig = {
  maxSuggestions: 24,
  minPrefixLength: 1,
  maxContextTokens: 2,
  ngramOrder: 3,
};

const NGRAM_SORT_PREFIX = '0_';

const robloxServices: CompletionItem[] = [
  { label: 'Players', kind: 5, insertText: 'Players', detail: 'Service', documentation: 'Manages all Player objects in the game' },
  { label: 'Workspace', kind: 5, insertText: 'Workspace', detail: 'Service', documentation: 'Contains all objects visible in the 3D world' },
  { label: 'ReplicatedStorage', kind: 5, insertText: 'ReplicatedStorage', detail: 'Service', documentation: 'Replicated to all clients' },
  { label: 'ReplicatedFirst', kind: 5, insertText: 'ReplicatedFirst', detail: 'Service', documentation: 'Replicated to clients before anything else' },
  { label: 'ServerStorage', kind: 5, insertText: 'ServerStorage', detail: 'Service', documentation: 'Server-only storage' },
  { label: 'ServerScriptService', kind: 5, insertText: 'ServerScriptService', detail: 'Service', documentation: 'Contains server-side scripts' },
  { label: 'StarterGui', kind: 5, insertText: 'StarterGui', detail: 'Service', documentation: 'GUI templates for players' },
  { label: 'StarterPack', kind: 5, insertText: 'StarterPack', detail: 'Service', documentation: 'Tools given to players on spawn' },
  { label: 'StarterPlayer', kind: 5, insertText: 'StarterPlayer', detail: 'Service', documentation: 'Player character settings' },
  { label: 'Lighting', kind: 5, insertText: 'Lighting', detail: 'Service', documentation: 'Controls lighting and atmosphere' },
  { label: 'SoundService', kind: 5, insertText: 'SoundService', detail: 'Service', documentation: 'Controls audio properties' },
  { label: 'TweenService', kind: 5, insertText: 'TweenService', detail: 'Service', documentation: 'Creates tweens for animations' },
  { label: 'RunService', kind: 5, insertText: 'RunService', detail: 'Service', documentation: 'Game loop and runtime control' },
  { label: 'UserInputService', kind: 5, insertText: 'UserInputService', detail: 'Service', documentation: 'Handles user input' },
  { label: 'ContextActionService', kind: 5, insertText: 'ContextActionService', detail: 'Service', documentation: 'Binds actions to inputs' },
  { label: 'HttpService', kind: 5, insertText: 'HttpService', detail: 'Service', documentation: 'HTTP requests and JSON utilities' },
  { label: 'MarketplaceService', kind: 5, insertText: 'MarketplaceService', detail: 'Service', documentation: 'Developer products and game passes' },
  { label: 'DataStoreService', kind: 5, insertText: 'DataStoreService', detail: 'Service', documentation: 'Persistent data storage' },
  { label: 'MessagingService', kind: 5, insertText: 'MessagingService', detail: 'Service', documentation: 'Cross-server messaging' },
  { label: 'TeleportService', kind: 5, insertText: 'TeleportService', detail: 'Service', documentation: 'Teleport players between places' },
  { label: 'TextService', kind: 5, insertText: 'TextService', detail: 'Service', documentation: 'Text filtering and sizing' },
  { label: 'PathfindingService', kind: 5, insertText: 'PathfindingService', detail: 'Service', documentation: 'AI pathfinding' },
  { label: 'PhysicsService', kind: 5, insertText: 'PhysicsService', detail: 'Service', documentation: 'Collision groups' },
  { label: 'CollectionService', kind: 5, insertText: 'CollectionService', detail: 'Service', documentation: 'Tag-based object management' },
  { label: 'Debris', kind: 5, insertText: 'Debris', detail: 'Service', documentation: 'Scheduled object destruction' },
  { label: 'Chat', kind: 5, insertText: 'Chat', detail: 'Service', documentation: 'Chat system control' },
  { label: 'Teams', kind: 5, insertText: 'Teams', detail: 'Service', documentation: 'Team management' },
  { label: 'MemoryStoreService', kind: 5, insertText: 'MemoryStoreService', detail: 'Service', documentation: 'Temporary cross-server storage' },
];

const globalFunctions: CompletionItem[] = [
  { label: 'print', kind: 1, insertText: 'print(${1:message})', detail: 'function', documentation: 'Prints to output', insertTextRules: 4 },
  { label: 'warn', kind: 1, insertText: 'warn(${1:message})', detail: 'function', documentation: 'Prints warning to output', insertTextRules: 4 },
  { label: 'error', kind: 1, insertText: 'error(${1:message}, ${2:level})', detail: 'function', documentation: 'Throws an error', insertTextRules: 4 },
  { label: 'assert', kind: 1, insertText: 'assert(${1:condition}, ${2:message})', detail: 'function', documentation: 'Asserts condition is truthy', insertTextRules: 4 },
  { label: 'type', kind: 1, insertText: 'type(${1:value})', detail: 'function', documentation: 'Returns type as string', insertTextRules: 4 },
  { label: 'typeof', kind: 1, insertText: 'typeof(${1:value})', detail: 'function', documentation: 'Returns Roblox type as string', insertTextRules: 4 },
  { label: 'tostring', kind: 1, insertText: 'tostring(${1:value})', detail: 'function', documentation: 'Converts to string', insertTextRules: 4 },
  { label: 'tonumber', kind: 1, insertText: 'tonumber(${1:value})', detail: 'function', documentation: 'Converts to number', insertTextRules: 4 },
  { label: 'pairs', kind: 1, insertText: 'pairs(${1:table})', detail: 'function', documentation: 'Iterator for key-value pairs', insertTextRules: 4 },
  { label: 'ipairs', kind: 1, insertText: 'ipairs(${1:table})', detail: 'function', documentation: 'Iterator for array indices', insertTextRules: 4 },
  { label: 'next', kind: 1, insertText: 'next(${1:table}, ${2:key})', detail: 'function', documentation: 'Returns next key-value pair', insertTextRules: 4 },
  { label: 'select', kind: 1, insertText: 'select(${1:index}, ${2:...})', detail: 'function', documentation: 'Returns arguments from index', insertTextRules: 4 },
  { label: 'unpack', kind: 1, insertText: 'unpack(${1:table})', detail: 'function', documentation: 'Unpacks table to arguments', insertTextRules: 4 },
  { label: 'pcall', kind: 1, insertText: 'pcall(${1:func}, ${2:...})', detail: 'function', documentation: 'Protected call', insertTextRules: 4 },
  { label: 'xpcall', kind: 1, insertText: 'xpcall(${1:func}, ${2:errorHandler})', detail: 'function', documentation: 'Protected call with error handler', insertTextRules: 4 },
  { label: 'require', kind: 1, insertText: 'require(${1:module})', detail: 'function', documentation: 'Loads a ModuleScript', insertTextRules: 4 },
  { label: 'getmetatable', kind: 1, insertText: 'getmetatable(${1:table})', detail: 'function', documentation: 'Gets metatable', insertTextRules: 4 },
  { label: 'setmetatable', kind: 1, insertText: 'setmetatable(${1:table}, ${2:metatable})', detail: 'function', documentation: 'Sets metatable', insertTextRules: 4 },
  { label: 'rawget', kind: 1, insertText: 'rawget(${1:table}, ${2:key})', detail: 'function', documentation: 'Gets value without metamethods', insertTextRules: 4 },
  { label: 'rawset', kind: 1, insertText: 'rawset(${1:table}, ${2:key}, ${3:value})', detail: 'function', documentation: 'Sets value without metamethods', insertTextRules: 4 },
  { label: 'rawequal', kind: 1, insertText: 'rawequal(${1:a}, ${2:b})', detail: 'function', documentation: 'Compares without metamethods', insertTextRules: 4 },
];

const taskFunctions: CompletionItem[] = [
  { label: 'task.spawn', kind: 1, insertText: 'task.spawn(${1:func})', detail: 'function', documentation: 'Runs function immediately in new thread', insertTextRules: 4 },
  { label: 'task.defer', kind: 1, insertText: 'task.defer(${1:func})', detail: 'function', documentation: 'Runs function after current resumption cycle', insertTextRules: 4 },
  { label: 'task.delay', kind: 1, insertText: 'task.delay(${1:seconds}, ${2:func})', detail: 'function', documentation: 'Runs function after delay', insertTextRules: 4 },
  { label: 'task.wait', kind: 1, insertText: 'task.wait(${1:seconds})', detail: 'function', documentation: 'Yields for specified time', insertTextRules: 4 },
  { label: 'task.cancel', kind: 1, insertText: 'task.cancel(${1:thread})', detail: 'function', documentation: 'Cancels a scheduled thread', insertTextRules: 4 },
];

const instanceMethods: CompletionItem[] = [
  { label: 'FindFirstChild', kind: 1, insertText: 'FindFirstChild(${1:name})', detail: 'method', documentation: 'Finds first child with name', insertTextRules: 4 },
  { label: 'FindFirstChildOfClass', kind: 1, insertText: 'FindFirstChildOfClass(${1:className})', detail: 'method', documentation: 'Finds first child of class', insertTextRules: 4 },
  { label: 'FindFirstChildWhichIsA', kind: 1, insertText: 'FindFirstChildWhichIsA(${1:className})', detail: 'method', documentation: 'Finds first child inheriting class', insertTextRules: 4 },
  { label: 'FindFirstAncestor', kind: 1, insertText: 'FindFirstAncestor(${1:name})', detail: 'method', documentation: 'Finds first ancestor with name', insertTextRules: 4 },
  { label: 'FindFirstAncestorOfClass', kind: 1, insertText: 'FindFirstAncestorOfClass(${1:className})', detail: 'method', documentation: 'Finds first ancestor of class', insertTextRules: 4 },
  { label: 'WaitForChild', kind: 1, insertText: 'WaitForChild(${1:name})', detail: 'method', documentation: 'Waits for child to exist', insertTextRules: 4 },
  { label: 'GetChildren', kind: 1, insertText: 'GetChildren()', detail: 'method', documentation: 'Returns array of children' },
  { label: 'GetDescendants', kind: 1, insertText: 'GetDescendants()', detail: 'method', documentation: 'Returns array of all descendants' },
  { label: 'IsA', kind: 1, insertText: 'IsA(${1:className})', detail: 'method', documentation: 'Checks if instance inherits class', insertTextRules: 4 },
  { label: 'IsDescendantOf', kind: 1, insertText: 'IsDescendantOf(${1:ancestor})', detail: 'method', documentation: 'Checks ancestry', insertTextRules: 4 },
  { label: 'IsAncestorOf', kind: 1, insertText: 'IsAncestorOf(${1:descendant})', detail: 'method', documentation: 'Checks if is ancestor', insertTextRules: 4 },
  { label: 'Destroy', kind: 1, insertText: 'Destroy()', detail: 'method', documentation: 'Destroys the instance' },
  { label: 'Clone', kind: 1, insertText: 'Clone()', detail: 'method', documentation: 'Creates a copy' },
  { label: 'GetAttribute', kind: 1, insertText: 'GetAttribute(${1:name})', detail: 'method', documentation: 'Gets attribute value', insertTextRules: 4 },
  { label: 'SetAttribute', kind: 1, insertText: 'SetAttribute(${1:name}, ${2:value})', detail: 'method', documentation: 'Sets attribute value', insertTextRules: 4 },
  { label: 'GetAttributes', kind: 1, insertText: 'GetAttributes()', detail: 'method', documentation: 'Gets all attributes as table' },
  { label: 'GetPropertyChangedSignal', kind: 1, insertText: 'GetPropertyChangedSignal(${1:property})', detail: 'method', documentation: 'Signal for property changes', insertTextRules: 4 },
  { label: 'GetFullName', kind: 1, insertText: 'GetFullName()', detail: 'method', documentation: 'Returns full hierarchy path' },
];

const playersServiceMembers: CompletionItem[] = [
  { label: 'LocalPlayer', kind: 5, insertText: 'LocalPlayer', detail: 'property', documentation: 'Local player instance (client only)' },
  { label: 'MaxPlayers', kind: 5, insertText: 'MaxPlayers', detail: 'property', documentation: 'Maximum number of players' },
  { label: 'PlayerAdded', kind: 5, insertText: 'PlayerAdded', detail: 'event', documentation: 'Fires when a player joins' },
  { label: 'PlayerRemoving', kind: 5, insertText: 'PlayerRemoving', detail: 'event', documentation: 'Fires when a player leaves' },
  { label: 'GetPlayers', kind: 1, insertText: 'GetPlayers()', detail: 'method', documentation: 'Returns array of players' },
  { label: 'GetPlayerFromCharacter', kind: 1, insertText: 'GetPlayerFromCharacter(${1:character})', detail: 'method', documentation: 'Returns player from character', insertTextRules: 4 },
];

const playerMembers: CompletionItem[] = [
  { label: 'Character', kind: 5, insertText: 'Character', detail: 'property', documentation: 'Player character model' },
  { label: 'CharacterAdded', kind: 5, insertText: 'CharacterAdded', detail: 'event', documentation: 'Fires when character spawns' },
  { label: 'PlayerGui', kind: 5, insertText: 'PlayerGui', detail: 'property', documentation: 'Player UI container' },
  { label: 'Backpack', kind: 5, insertText: 'Backpack', detail: 'property', documentation: 'Backpack container' },
  { label: 'UserId', kind: 5, insertText: 'UserId', detail: 'property', documentation: 'Unique player id' },
  { label: 'DisplayName', kind: 5, insertText: 'DisplayName', detail: 'property', documentation: 'Display name' },
  { label: 'Kick', kind: 1, insertText: 'Kick(${1:message})', detail: 'method', documentation: 'Kicks the player', insertTextRules: 4 },
  { label: 'LoadCharacter', kind: 1, insertText: 'LoadCharacter()', detail: 'method', documentation: 'Respawns character' },
  { label: 'GetMouse', kind: 1, insertText: 'GetMouse()', detail: 'method', documentation: 'Returns mouse object' },
];

const constructors: CompletionItem[] = [
  { label: 'Instance.new', kind: 1, insertText: 'Instance.new(${1:className})', detail: 'constructor', documentation: 'Creates new instance', insertTextRules: 4 },
  { label: 'Vector3.new', kind: 1, insertText: 'Vector3.new(${1:x}, ${2:y}, ${3:z})', detail: 'constructor', documentation: 'Creates Vector3', insertTextRules: 4 },
  { label: 'Vector2.new', kind: 1, insertText: 'Vector2.new(${1:x}, ${2:y})', detail: 'constructor', documentation: 'Creates Vector2', insertTextRules: 4 },
  { label: 'CFrame.new', kind: 1, insertText: 'CFrame.new(${1:x}, ${2:y}, ${3:z})', detail: 'constructor', documentation: 'Creates CFrame', insertTextRules: 4 },
  { label: 'CFrame.lookAt', kind: 1, insertText: 'CFrame.lookAt(${1:position}, ${2:lookAt})', detail: 'constructor', documentation: 'Creates CFrame looking at target', insertTextRules: 4 },
  { label: 'Color3.new', kind: 1, insertText: 'Color3.new(${1:r}, ${2:g}, ${3:b})', detail: 'constructor', documentation: 'Creates Color3 (0-1 values)', insertTextRules: 4 },
  { label: 'Color3.fromRGB', kind: 1, insertText: 'Color3.fromRGB(${1:r}, ${2:g}, ${3:b})', detail: 'constructor', documentation: 'Creates Color3 (0-255 values)', insertTextRules: 4 },
  { label: 'Color3.fromHSV', kind: 1, insertText: 'Color3.fromHSV(${1:h}, ${2:s}, ${3:v})', detail: 'constructor', documentation: 'Creates Color3 from HSV', insertTextRules: 4 },
  { label: 'Color3.fromHex', kind: 1, insertText: 'Color3.fromHex(${1:hex})', detail: 'constructor', documentation: 'Creates Color3 from hex string', insertTextRules: 4 },
  { label: 'UDim.new', kind: 1, insertText: 'UDim.new(${1:scale}, ${2:offset})', detail: 'constructor', documentation: 'Creates UDim', insertTextRules: 4 },
  { label: 'UDim2.new', kind: 1, insertText: 'UDim2.new(${1:xScale}, ${2:xOffset}, ${3:yScale}, ${4:yOffset})', detail: 'constructor', documentation: 'Creates UDim2', insertTextRules: 4 },
  { label: 'UDim2.fromScale', kind: 1, insertText: 'UDim2.fromScale(${1:x}, ${2:y})', detail: 'constructor', documentation: 'Creates UDim2 from scale', insertTextRules: 4 },
  { label: 'UDim2.fromOffset', kind: 1, insertText: 'UDim2.fromOffset(${1:x}, ${2:y})', detail: 'constructor', documentation: 'Creates UDim2 from offset', insertTextRules: 4 },
  { label: 'TweenInfo.new', kind: 1, insertText: 'TweenInfo.new(${1:time}, ${2:Enum.EasingStyle.Quad}, ${3:Enum.EasingDirection.Out})', detail: 'constructor', documentation: 'Creates TweenInfo', insertTextRules: 4 },
  { label: 'RaycastParams.new', kind: 1, insertText: 'RaycastParams.new()', detail: 'constructor', documentation: 'Creates RaycastParams' },
  { label: 'OverlapParams.new', kind: 1, insertText: 'OverlapParams.new()', detail: 'constructor', documentation: 'Creates OverlapParams' },
  { label: 'NumberSequence.new', kind: 1, insertText: 'NumberSequence.new(${1:value})', detail: 'constructor', documentation: 'Creates NumberSequence', insertTextRules: 4 },
  { label: 'ColorSequence.new', kind: 1, insertText: 'ColorSequence.new(${1:color})', detail: 'constructor', documentation: 'Creates ColorSequence', insertTextRules: 4 },
  { label: 'NumberRange.new', kind: 1, insertText: 'NumberRange.new(${1:min}, ${2:max})', detail: 'constructor', documentation: 'Creates NumberRange', insertTextRules: 4 },
  { label: 'Region3.new', kind: 1, insertText: 'Region3.new(${1:min}, ${2:max})', detail: 'constructor', documentation: 'Creates Region3', insertTextRules: 4 },
  { label: 'Ray.new', kind: 1, insertText: 'Ray.new(${1:origin}, ${2:direction})', detail: 'constructor', documentation: 'Creates Ray', insertTextRules: 4 },
  { label: 'Rect.new', kind: 1, insertText: 'Rect.new(${1:x}, ${2:y}, ${3:width}, ${4:height})', detail: 'constructor', documentation: 'Creates Rect', insertTextRules: 4 },
  { label: 'BrickColor.new', kind: 1, insertText: 'BrickColor.new(${1:name})', detail: 'constructor', documentation: 'Creates BrickColor', insertTextRules: 4 },
];

const luaKeywords: CompletionItem[] = [
  { label: 'and', kind: 13, insertText: 'and', detail: 'keyword', sortText: '0_and' },
  { label: 'break', kind: 13, insertText: 'break', detail: 'keyword', sortText: '0_break' },
  { label: 'do', kind: 13, insertText: 'do', detail: 'keyword', sortText: '0_do', filterText: 'do' },
  { label: 'else', kind: 13, insertText: 'else', detail: 'keyword', sortText: '0_else' },
  { label: 'elseif', kind: 13, insertText: 'elseif', detail: 'keyword', sortText: '0_elseif' },
  { label: 'end', kind: 13, insertText: 'end', detail: 'keyword', sortText: '0_end' },
  { label: 'false', kind: 13, insertText: 'false', detail: 'keyword', sortText: '0_false' },
  { label: 'for', kind: 13, insertText: 'for', detail: 'keyword', sortText: '0_for' },
  { label: 'function', kind: 13, insertText: 'function', detail: 'keyword', sortText: '0_function' },
  { label: 'if', kind: 13, insertText: 'if', detail: 'keyword', sortText: '0_if' },
  { label: 'in', kind: 13, insertText: 'in', detail: 'keyword', sortText: '0_in' },
  { label: 'local', kind: 13, insertText: 'local', detail: 'keyword', sortText: '0_local' },
  { label: 'nil', kind: 13, insertText: 'nil', detail: 'keyword', sortText: '0_nil' },
  { label: 'not', kind: 13, insertText: 'not', detail: 'keyword', sortText: '0_not' },
  { label: 'or', kind: 13, insertText: 'or', detail: 'keyword', sortText: '0_or' },
  { label: 'repeat', kind: 13, insertText: 'repeat', detail: 'keyword', sortText: '0_repeat' },
  { label: 'return', kind: 13, insertText: 'return', detail: 'keyword', sortText: '0_return' },
  { label: 'then', kind: 13, insertText: 'then', detail: 'keyword', sortText: '0_then' },
  { label: 'true', kind: 13, insertText: 'true', detail: 'keyword', sortText: '0_true' },
  { label: 'until', kind: 13, insertText: 'until', detail: 'keyword', sortText: '0_until' },
  { label: 'while', kind: 13, insertText: 'while', detail: 'keyword', sortText: '0_while' },
  { label: 'continue', kind: 13, insertText: 'continue', detail: 'keyword', sortText: '0_continue' },
];

const snippets: CompletionItem[] = [
  {
    label: 'for i loop',
    kind: 14,
    insertText: 'for ${1:i} = ${2:1}, ${3:10} do\n\t${0}\nend',
    detail: 'snippet',
    documentation: 'Numeric for loop',
    insertTextRules: 4,
  },
  {
    label: 'for pairs',
    kind: 14,
    insertText: 'for ${1:key}, ${2:value} in pairs(${3:table}) do\n\t${0}\nend',
    detail: 'snippet',
    documentation: 'For loop with pairs',
    insertTextRules: 4,
  },
  {
    label: 'for ipairs',
    kind: 14,
    insertText: 'for ${1:index}, ${2:value} in ipairs(${3:table}) do\n\t${0}\nend',
    detail: 'snippet',
    documentation: 'For loop with ipairs',
    insertTextRules: 4,
  },
  {
    label: 'function',
    kind: 14,
    insertText: 'function ${1:name}(${2:params})\n\t${0}\nend',
    detail: 'snippet',
    documentation: 'Function declaration',
    insertTextRules: 4,
  },
  {
    label: 'local function',
    kind: 14,
    insertText: 'local function ${1:name}(${2:params})\n\t${0}\nend',
    detail: 'snippet',
    documentation: 'Local function declaration',
    insertTextRules: 4,
  },
  {
    label: 'if then',
    kind: 14,
    insertText: 'if ${1:condition} then\n\t${0}\nend',
    detail: 'snippet',
    documentation: 'If statement',
    insertTextRules: 4,
  },
  {
    label: 'if else',
    kind: 14,
    insertText: 'if ${1:condition} then\n\t${2}\nelse\n\t${0}\nend',
    detail: 'snippet',
    documentation: 'If-else statement',
    insertTextRules: 4,
  },
  {
    label: 'while do',
    kind: 14,
    insertText: 'while ${1:condition} do\n\t${0}\nend',
    detail: 'snippet',
    documentation: 'While loop',
    insertTextRules: 4,
  },
  {
    label: 'repeat until',
    kind: 14,
    insertText: 'repeat\n\t${0}\nuntil ${1:condition}',
    detail: 'snippet',
    documentation: 'Repeat-until loop',
    insertTextRules: 4,
  },
  {
    label: 'pcall pattern',
    kind: 14,
    insertText: 'local ${1:success}, ${2:result} = pcall(function()\n\t${0}\nend)',
    detail: 'snippet',
    documentation: 'Protected call pattern',
    insertTextRules: 4,
  },
  {
    label: 'GetService',
    kind: 14,
    insertText: 'local ${1:ServiceName} = game:GetService("${1:ServiceName}")',
    detail: 'snippet',
    documentation: 'Get Roblox service',
    insertTextRules: 4,
  },
  {
    label: 'Connect',
    kind: 14,
    insertText: '${1:signal}:Connect(function(${2:params})\n\t${0}\nend)',
    detail: 'snippet',
    documentation: 'Connect to signal',
    insertTextRules: 4,
  },
  {
    label: 'PlayerAdded',
    kind: 14,
    insertText: 'Players.PlayerAdded:Connect(function(player)\n\t${0}\nend)',
    detail: 'snippet',
    documentation: 'Player added handler',
    insertTextRules: 4,
  },
  {
    label: 'CharacterAdded',
    kind: 14,
    insertText: 'player.CharacterAdded:Connect(function(character)\n\t${0}\nend)',
    detail: 'snippet',
    documentation: 'Character added handler',
    insertTextRules: 4,
  },
  {
    label: 'RemoteEvent server',
    kind: 14,
    insertText: '${1:remoteEvent}.OnServerEvent:Connect(function(player, ${2:data})\n\t${0}\nend)',
    detail: 'snippet',
    documentation: 'RemoteEvent server handler',
    insertTextRules: 4,
  },
  {
    label: 'RemoteEvent client',
    kind: 14,
    insertText: '${1:remoteEvent}.OnClientEvent:Connect(function(${2:data})\n\t${0}\nend)',
    detail: 'snippet',
    documentation: 'RemoteEvent client handler',
    insertTextRules: 4,
  },
  {
    label: 'Tween',
    kind: 14,
    insertText: 'local tweenInfo = TweenInfo.new(${1:1}, Enum.EasingStyle.${2:Quad}, Enum.EasingDirection.${3:Out})\nlocal tween = TweenService:Create(${4:instance}, tweenInfo, {\n\t${5:Property} = ${6:value}\n})\ntween:Play()',
    detail: 'snippet',
    documentation: 'Create and play tween',
    insertTextRules: 4,
  },
  {
    label: 'ModuleScript',
    kind: 14,
    insertText: 'local ${1:Module} = {}\n\nfunction ${1:Module}.${2:functionName}(${3:params})\n\t${0}\nend\n\nreturn ${1:Module}',
    detail: 'snippet',
    documentation: 'ModuleScript template',
    insertTextRules: 4,
  },
];

const mathCompletions: CompletionItem[] = [
  { label: 'math.abs', kind: 1, insertText: 'math.abs(${1:x})', detail: 'function', documentation: 'Absolute value', insertTextRules: 4 },
  { label: 'math.ceil', kind: 1, insertText: 'math.ceil(${1:x})', detail: 'function', documentation: 'Round up', insertTextRules: 4 },
  { label: 'math.floor', kind: 1, insertText: 'math.floor(${1:x})', detail: 'function', documentation: 'Round down', insertTextRules: 4 },
  { label: 'math.round', kind: 1, insertText: 'math.round(${1:x})', detail: 'function', documentation: 'Round to nearest integer', insertTextRules: 4 },
  { label: 'math.clamp', kind: 1, insertText: 'math.clamp(${1:x}, ${2:min}, ${3:max})', detail: 'function', documentation: 'Clamp value between min and max', insertTextRules: 4 },
  { label: 'math.min', kind: 1, insertText: 'math.min(${1:...})', detail: 'function', documentation: 'Minimum value', insertTextRules: 4 },
  { label: 'math.max', kind: 1, insertText: 'math.max(${1:...})', detail: 'function', documentation: 'Maximum value', insertTextRules: 4 },
  { label: 'math.sin', kind: 1, insertText: 'math.sin(${1:x})', detail: 'function', documentation: 'Sine', insertTextRules: 4 },
  { label: 'math.cos', kind: 1, insertText: 'math.cos(${1:x})', detail: 'function', documentation: 'Cosine', insertTextRules: 4 },
  { label: 'math.tan', kind: 1, insertText: 'math.tan(${1:x})', detail: 'function', documentation: 'Tangent', insertTextRules: 4 },
  { label: 'math.rad', kind: 1, insertText: 'math.rad(${1:degrees})', detail: 'function', documentation: 'Degrees to radians', insertTextRules: 4 },
  { label: 'math.deg', kind: 1, insertText: 'math.deg(${1:radians})', detail: 'function', documentation: 'Radians to degrees', insertTextRules: 4 },
  { label: 'math.sqrt', kind: 1, insertText: 'math.sqrt(${1:x})', detail: 'function', documentation: 'Square root', insertTextRules: 4 },
  { label: 'math.pow', kind: 1, insertText: 'math.pow(${1:x}, ${2:y})', detail: 'function', documentation: 'Power', insertTextRules: 4 },
  { label: 'math.random', kind: 1, insertText: 'math.random(${1:min}, ${2:max})', detail: 'function', documentation: 'Random number', insertTextRules: 4 },
  { label: 'math.randomseed', kind: 1, insertText: 'math.randomseed(${1:seed})', detail: 'function', documentation: 'Set random seed', insertTextRules: 4 },
  { label: 'math.noise', kind: 1, insertText: 'math.noise(${1:x}, ${2:y}, ${3:z})', detail: 'function', documentation: 'Perlin noise', insertTextRules: 4 },
  { label: 'math.sign', kind: 1, insertText: 'math.sign(${1:x})', detail: 'function', documentation: 'Sign of number (-1, 0, or 1)', insertTextRules: 4 },
  { label: 'math.pi', kind: 5, insertText: 'math.pi', detail: 'constant', documentation: 'Pi (3.14159...)' },
  { label: 'math.huge', kind: 5, insertText: 'math.huge', detail: 'constant', documentation: 'Infinity' },
];

const stringCompletions: CompletionItem[] = [
  { label: 'string.sub', kind: 1, insertText: 'string.sub(${1:str}, ${2:i}, ${3:j})', detail: 'function', documentation: 'Extract substring', insertTextRules: 4 },
  { label: 'string.len', kind: 1, insertText: 'string.len(${1:str})', detail: 'function', documentation: 'String length', insertTextRules: 4 },
  { label: 'string.lower', kind: 1, insertText: 'string.lower(${1:str})', detail: 'function', documentation: 'Convert to lowercase', insertTextRules: 4 },
  { label: 'string.upper', kind: 1, insertText: 'string.upper(${1:str})', detail: 'function', documentation: 'Convert to uppercase', insertTextRules: 4 },
  { label: 'string.find', kind: 1, insertText: 'string.find(${1:str}, ${2:pattern})', detail: 'function', documentation: 'Find pattern in string', insertTextRules: 4 },
  { label: 'string.match', kind: 1, insertText: 'string.match(${1:str}, ${2:pattern})', detail: 'function', documentation: 'Match pattern', insertTextRules: 4 },
  { label: 'string.gmatch', kind: 1, insertText: 'string.gmatch(${1:str}, ${2:pattern})', detail: 'function', documentation: 'Iterator for pattern matches', insertTextRules: 4 },
  { label: 'string.gsub', kind: 1, insertText: 'string.gsub(${1:str}, ${2:pattern}, ${3:replacement})', detail: 'function', documentation: 'Replace pattern', insertTextRules: 4 },
  { label: 'string.format', kind: 1, insertText: 'string.format(${1:format}, ${2:...})', detail: 'function', documentation: 'Format string', insertTextRules: 4 },
  { label: 'string.rep', kind: 1, insertText: 'string.rep(${1:str}, ${2:n})', detail: 'function', documentation: 'Repeat string n times', insertTextRules: 4 },
  { label: 'string.reverse', kind: 1, insertText: 'string.reverse(${1:str})', detail: 'function', documentation: 'Reverse string', insertTextRules: 4 },
  { label: 'string.split', kind: 1, insertText: 'string.split(${1:str}, ${2:separator})', detail: 'function', documentation: 'Split string by separator', insertTextRules: 4 },
  { label: 'string.byte', kind: 1, insertText: 'string.byte(${1:str}, ${2:i})', detail: 'function', documentation: 'Get byte value at position', insertTextRules: 4 },
  { label: 'string.char', kind: 1, insertText: 'string.char(${1:...})', detail: 'function', documentation: 'Convert bytes to string', insertTextRules: 4 },
];

const tableCompletions: CompletionItem[] = [
  { label: 'table.insert', kind: 1, insertText: 'table.insert(${1:table}, ${2:value})', detail: 'function', documentation: 'Insert value at end', insertTextRules: 4 },
  { label: 'table.remove', kind: 1, insertText: 'table.remove(${1:table}, ${2:index})', detail: 'function', documentation: 'Remove and return element', insertTextRules: 4 },
  { label: 'table.sort', kind: 1, insertText: 'table.sort(${1:table}, ${2:compareFunc})', detail: 'function', documentation: 'Sort table in place', insertTextRules: 4 },
  { label: 'table.concat', kind: 1, insertText: 'table.concat(${1:table}, ${2:separator})', detail: 'function', documentation: 'Concatenate array elements', insertTextRules: 4 },
  { label: 'table.find', kind: 1, insertText: 'table.find(${1:table}, ${2:value})', detail: 'function', documentation: 'Find value index', insertTextRules: 4 },
  { label: 'table.clear', kind: 1, insertText: 'table.clear(${1:table})', detail: 'function', documentation: 'Clear all entries', insertTextRules: 4 },
  { label: 'table.clone', kind: 1, insertText: 'table.clone(${1:table})', detail: 'function', documentation: 'Shallow copy', insertTextRules: 4 },
  { label: 'table.freeze', kind: 1, insertText: 'table.freeze(${1:table})', detail: 'function', documentation: 'Make table read-only', insertTextRules: 4 },
  { label: 'table.isfrozen', kind: 1, insertText: 'table.isfrozen(${1:table})', detail: 'function', documentation: 'Check if table is frozen', insertTextRules: 4 },
  { label: 'table.create', kind: 1, insertText: 'table.create(${1:size}, ${2:value})', detail: 'function', documentation: 'Create array with size', insertTextRules: 4 },
  { label: 'table.pack', kind: 1, insertText: 'table.pack(${1:...})', detail: 'function', documentation: 'Pack arguments into table', insertTextRules: 4 },
  { label: 'table.unpack', kind: 1, insertText: 'table.unpack(${1:table})', detail: 'function', documentation: 'Unpack table to arguments', insertTextRules: 4 },
  { label: 'table.move', kind: 1, insertText: 'table.move(${1:src}, ${2:a}, ${3:b}, ${4:dest})', detail: 'function', documentation: 'Move elements between tables', insertTextRules: 4 },
];

const executorEnvironment: CompletionItem[] = [
  { label: 'getgenv', kind: 1, insertText: 'getgenv()', detail: 'executor', documentation: 'Returns the executor\'s global environment table, shared across all executor-made threads' },
  { label: 'getrenv', kind: 1, insertText: 'getrenv()', detail: 'executor', documentation: 'Returns the Roblox global environment used by the entire game' },
  { label: 'getsenv', kind: 1, insertText: 'getsenv(${1:script})', detail: 'executor', documentation: 'Returns the global environment table of a given script', insertTextRules: 4 },
  { label: 'getgc', kind: 1, insertText: 'getgc(${1:includeTables})', detail: 'executor', documentation: 'Returns a list of non-dead garbage-collectable values (functions, userdatas, optionally tables)', insertTextRules: 4 },
  { label: 'filtergc', kind: 1, insertText: 'filtergc(${1:filterType}, ${2:filterOptions}, ${3:returnOne})', detail: 'executor', documentation: 'Retrieves specific garbage-collected values using fine-tuned filters (by name, hash, constants, upvalues, keys, metatable)', insertTextRules: 4 },
  { label: 'getreg', kind: 1, insertText: 'getreg()', detail: 'executor', documentation: 'Returns the Luau registry table used internally to store references between C and Luau' },
  { label: 'getinstances', kind: 1, insertText: 'getinstances()', detail: 'executor', documentation: 'Retrieves every Instance from the registry, including nil-parented ones' },
  { label: 'getnilinstances', kind: 1, insertText: 'getnilinstances()', detail: 'executor', documentation: 'Returns Instances that are currently unparented (exist in memory but not in the DataModel)' },
  { label: 'getscripts', kind: 1, insertText: 'getscripts()', detail: 'executor', documentation: 'Returns all Script, LocalScript, and ModuleScript instances present (excluding CoreScripts)' },
  { label: 'getloadedmodules', kind: 1, insertText: 'getloadedmodules()', detail: 'executor', documentation: 'Returns a list of all ModuleScript instances that have been loaded (required)' },
  { label: 'getrunningscripts', kind: 1, insertText: 'getrunningscripts()', detail: 'executor', documentation: 'Returns a list of all currently running scripts in the caller\'s global state' },
  { label: 'getcallingscript', kind: 1, insertText: 'getcallingscript()', detail: 'executor', documentation: 'Returns the Script, LocalScript, or ModuleScript that triggered the current code execution' },
  { label: 'getscriptclosure', kind: 1, insertText: 'getscriptclosure(${1:script})', detail: 'executor', documentation: 'Creates and returns a new Luau function closure compiled from a script\'s bytecode', insertTextRules: 4 },
  { label: 'getscripthash', kind: 1, insertText: 'getscripthash(${1:script})', detail: 'executor', documentation: 'Returns a SHA-384 hex hash of the raw bytecode for a given script', insertTextRules: 4 },
  { label: 'getscriptbytecode', kind: 1, insertText: 'getscriptbytecode(${1:script})', detail: 'executor', documentation: 'Retrieves the bytecode of a script instance', insertTextRules: 4 },
  { label: 'getthreadidentity', kind: 1, insertText: 'getthreadidentity()', detail: 'executor', documentation: 'Retrieves the thread identity of the running Luau thread' },
  { label: 'setthreadidentity', kind: 1, insertText: 'setthreadidentity(${1:id})', detail: 'executor', documentation: 'Sets the current Luau thread identity and capabilities matching that identity', insertTextRules: 4 },
];

const executorHooking: CompletionItem[] = [
  { label: 'hookfunction', kind: 1, insertText: 'hookfunction(${1:functionToHook}, ${2:hook})', detail: 'executor', documentation: 'Hooks a function with another, returning the original unhooked function', insertTextRules: 4 },
  { label: 'hookmetamethod', kind: 1, insertText: 'hookmetamethod(${1:object}, ${2:metamethodName}, ${3:hook})', detail: 'executor', documentation: 'Hooks a metamethod on an object\'s metatable, internally uses hookfunction', insertTextRules: 4 },
  { label: 'restorefunction', kind: 1, insertText: 'restorefunction(${1:func})', detail: 'executor', documentation: 'Restores a hooked function back to the original, even if hooked multiple times. Errors if not hooked', insertTextRules: 4 },
  { label: 'newcclosure', kind: 1, insertText: 'newcclosure(${1:func})', detail: 'executor', documentation: 'Wraps a Luau function into a C closure. The wrapped function must be yieldable', insertTextRules: 4 },
  { label: 'iscclosure', kind: 1, insertText: 'iscclosure(${1:func})', detail: 'executor', documentation: 'Checks whether a given function is a C closure', insertTextRules: 4 },
  { label: 'islclosure', kind: 1, insertText: 'islclosure(${1:func})', detail: 'executor', documentation: 'Checks whether a given function is a Luau closure', insertTextRules: 4 },
  { label: 'isexecutorclosure', kind: 1, insertText: 'isexecutorclosure(${1:func})', detail: 'executor', documentation: 'Checks whether a given function is a closure of the executor', insertTextRules: 4 },
  { label: 'checkcaller', kind: 1, insertText: 'checkcaller()', detail: 'executor', documentation: 'Returns true if the current function was invoked from the executor\'s own thread' },
  { label: 'clonefunction', kind: 1, insertText: 'clonefunction(${1:func})', detail: 'executor', documentation: 'Creates and returns a new function with the exact same behaviour as the passed function', insertTextRules: 4 },
  { label: 'getfunctionhash', kind: 1, insertText: 'getfunctionhash(${1:func})', detail: 'executor', documentation: 'Returns the hex-represented SHA384 hash of a function\'s instructions and constants. C closures not supported', insertTextRules: 4 },
  { label: 'getrawmetatable', kind: 1, insertText: 'getrawmetatable(${1:object})', detail: 'executor', documentation: 'Returns the raw metatable of an object, bypassing __metatable protection', insertTextRules: 4 },
  { label: 'setrawmetatable', kind: 1, insertText: 'setrawmetatable(${1:object}, ${2:metatable})', detail: 'executor', documentation: 'Forcibly sets the metatable of a value, bypassing __metatable protection', insertTextRules: 4 },
  { label: 'getnamecallmethod', kind: 1, insertText: 'getnamecallmethod()', detail: 'executor', documentation: 'Returns the method name that invoked the __namecall metamethod (must be called from within a __namecall hook)' },
  { label: 'gethiddenproperty', kind: 1, insertText: 'gethiddenproperty(${1:instance}, ${2:property})', detail: 'executor', documentation: 'Retrieves the value of a hidden or non-scriptable property from an Instance', insertTextRules: 4 },
  { label: 'sethiddenproperty', kind: 1, insertText: 'sethiddenproperty(${1:instance}, ${2:property}, ${3:value})', detail: 'executor', documentation: 'Assigns a value to a hidden or non-scriptable property of an Instance', insertTextRules: 4 },
  { label: 'setreadonly', kind: 1, insertText: 'setreadonly(${1:table}, ${2:state})', detail: 'executor', documentation: 'Sets whether a table is readonly or writable', insertTextRules: 4 },
  { label: 'isreadonly', kind: 1, insertText: 'isreadonly(${1:table})', detail: 'executor', documentation: 'Checks whether a table is currently set as readonly', insertTextRules: 4 },
  { label: 'isscriptable', kind: 1, insertText: 'isscriptable(${1:object}, ${2:property})', detail: 'executor', documentation: 'Returns whether a given property of an Instance is scriptable', insertTextRules: 4 },
  { label: 'setscriptable', kind: 1, insertText: 'setscriptable(${1:instance}, ${2:property}, ${3:state})', detail: 'executor', documentation: 'Toggles the scriptability of a hidden or non-scriptable property on an Instance', insertTextRules: 4 },
];

const executorDebug: CompletionItem[] = [
  { label: 'debug.getconstant', kind: 1, insertText: 'debug.getconstant(${1:func}, ${2:index})', detail: 'executor', documentation: 'Returns the constant at the specified index from a Luau function. C closures not supported', insertTextRules: 4 },
  { label: 'debug.setconstant', kind: 1, insertText: 'debug.setconstant(${1:func}, ${2:index}, ${3:value})', detail: 'executor', documentation: 'Modifies a constant at the specified index in a Luau function bytecode', insertTextRules: 4 },
  { label: 'debug.getconstants', kind: 1, insertText: 'debug.getconstants(${1:func})', detail: 'executor', documentation: 'Returns a list of all constants used within a Luau function\'s bytecode', insertTextRules: 4 },
  { label: 'debug.getupvalue', kind: 1, insertText: 'debug.getupvalue(${1:func}, ${2:index})', detail: 'executor', documentation: 'Returns the upvalue at the specified index from a Luau function\'s closure', insertTextRules: 4 },
  { label: 'debug.setupvalue', kind: 1, insertText: 'debug.setupvalue(${1:func}, ${2:index}, ${3:value})', detail: 'executor', documentation: 'Replaces an upvalue at the specified index in a Luau function', insertTextRules: 4 },
  { label: 'debug.getupvalues', kind: 1, insertText: 'debug.getupvalues(${1:func})', detail: 'executor', documentation: 'Returns a list of all upvalues captured by a Luau function', insertTextRules: 4 },
  { label: 'debug.getproto', kind: 1, insertText: 'debug.getproto(${1:func}, ${2:index}, ${3:activated})', detail: 'executor', documentation: 'Returns a specific function prototype from a Luau function by index. Set activated to true for active functions', insertTextRules: 4 },
  { label: 'debug.getprotos', kind: 1, insertText: 'debug.getprotos(${1:func})', detail: 'executor', documentation: 'Returns all function prototypes (nested functions) defined within the specified Luau function', insertTextRules: 4 },
  { label: 'debug.getstack', kind: 1, insertText: 'debug.getstack(${1:level}, ${2:index})', detail: 'executor', documentation: 'Retrieves values from the stack at the specified call level', insertTextRules: 4 },
  { label: 'debug.setstack', kind: 1, insertText: 'debug.setstack(${1:level}, ${2:index}, ${3:value})', detail: 'executor', documentation: 'Replaces a value in a specified stack frame', insertTextRules: 4 },
  { label: 'getconnections', kind: 1, insertText: 'getconnections(${1:signal})', detail: 'executor', documentation: 'Retrieves a list of Connection objects currently attached to a given RBXScriptSignal', insertTextRules: 4 },
  { label: 'firesignal', kind: 1, insertText: 'firesignal(${1:signal}, ${2:...})', detail: 'executor', documentation: 'Invokes all Luau connections connected to a given RBXScriptSignal immediately', insertTextRules: 4 },
  { label: 'replicatesignal', kind: 1, insertText: 'replicatesignal(${1:signal}, ${2:...})', detail: 'executor', documentation: 'Replicates a signal to the server with the provided arguments', insertTextRules: 4 },
];

const executorFilesystem: CompletionItem[] = [
  { label: 'readfile', kind: 1, insertText: 'readfile(${1:path})', detail: 'executor', documentation: 'Retrieves the contents of a file at the specified path and returns it as a string', insertTextRules: 4 },
  { label: 'writefile', kind: 1, insertText: 'writefile(${1:path}, ${2:data})', detail: 'executor', documentation: 'Writes data to a file at the specified path, overwriting if it exists', insertTextRules: 4 },
  { label: 'appendfile', kind: 1, insertText: 'appendfile(${1:path}, ${2:contents})', detail: 'executor', documentation: 'Appends string content to the end of a file. Creates the file if it does not exist', insertTextRules: 4 },
  { label: 'loadfile', kind: 1, insertText: 'loadfile(${1:path})', detail: 'executor', documentation: 'Compiles Luau source code from a file and returns the resulting function chunk', insertTextRules: 4 },
  { label: 'isfile', kind: 1, insertText: 'isfile(${1:path})', detail: 'executor', documentation: 'Checks whether a given path exists and refers to a file', insertTextRules: 4 },
  { label: 'isfolder', kind: 1, insertText: 'isfolder(${1:path})', detail: 'executor', documentation: 'Checks whether a given path exists and refers to a folder', insertTextRules: 4 },
  { label: 'makefolder', kind: 1, insertText: 'makefolder(${1:path})', detail: 'executor', documentation: 'Creates a folder at the specified path if one does not already exist', insertTextRules: 4 },
  { label: 'delfolder', kind: 1, insertText: 'delfolder(${1:path})', detail: 'executor', documentation: 'Deletes the folder at the specified path', insertTextRules: 4 },
  { label: 'delfile', kind: 1, insertText: 'delfile(${1:path})', detail: 'executor', documentation: 'Deletes the file at the specified path', insertTextRules: 4 },
  { label: 'listfiles', kind: 1, insertText: 'listfiles(${1:path})', detail: 'executor', documentation: 'Returns an array of all files and folders within the specified directory', insertTextRules: 4 },
  { label: 'getcustomasset', kind: 1, insertText: 'getcustomasset(${1:path})', detail: 'executor', documentation: 'Returns a content ID (rbxasset://) for loading local files as Roblox assets', insertTextRules: 4 },
];

const executorFiring: CompletionItem[] = [
  { label: 'fireclickdetector', kind: 1, insertText: 'fireclickdetector(${1:detector}, ${2:distance}, ${3:event})', detail: 'executor', documentation: 'Triggers a ClickDetector event, defaulting to MouseClick', insertTextRules: 4 },
  { label: 'fireproximityprompt', kind: 1, insertText: 'fireproximityprompt(${1:prompt})', detail: 'executor', documentation: 'Instantly triggers a ProximityPrompt, bypassing HoldDuration and activation distance', insertTextRules: 4 },
  { label: 'firetouchinterest', kind: 1, insertText: 'firetouchinterest(${1:part1}, ${2:part2}, ${3:toggle})', detail: 'executor', documentation: 'Simulates a physical touch event (start or end) between two BaseParts', insertTextRules: 4 },
  { label: 'getcallbackvalue', kind: 1, insertText: 'getcallbackvalue(${1:object}, ${2:property})', detail: 'executor', documentation: 'Retrieves the assigned callback property (normally write-only) from an Instance', insertTextRules: 4 },
];

const executorHttp: CompletionItem[] = [
  { label: 'request', kind: 1, insertText: 'request({\n\tUrl = ${1:url},\n\tMethod = "${2:GET}",\n\tHeaders = {},\n\tBody = ""\n})', detail: 'executor', documentation: 'Sends an HTTP request using the provided configuration table and returns a structured response', insertTextRules: 4 },
];

const executorMisc: CompletionItem[] = [
  { label: 'raknet', kind: 5, insertText: 'raknet', detail: 'executor library', documentation: 'RakNet networking library for hooking, sending, and receiving packets' },
  { label: 'gethui', kind: 1, insertText: 'gethui()', detail: 'executor', documentation: 'Returns a hidden container for safely storing UI elements to avoid detections' },
  { label: 'identifyexecutor', kind: 1, insertText: 'identifyexecutor()', detail: 'executor', documentation: 'Returns the name and version of the currently running executor' },
  { label: 'cloneref', kind: 1, insertText: 'cloneref(${1:object})', detail: 'executor', documentation: 'Creates a reference clone of an Instance that is not strictly equal to the original', insertTextRules: 4 },
  { label: 'compareinstances', kind: 1, insertText: 'compareinstances(${1:object1}, ${2:object2})', detail: 'executor', documentation: 'Checks if two Instances refer to the same underlying object, even through cloneref\'d references', insertTextRules: 4 },
  { label: 'loadstring', kind: 1, insertText: 'loadstring(${1:source}, ${2:chunkname})', detail: 'executor', documentation: 'Compiles a string of Luau code and returns it as a runnable function', insertTextRules: 4 },
];

const executorRacknet: CompletionItem[] = [
  { label: 'raknet.add_send_hook', kind: 1, insertText: 'raknet.add_send_hook(${1:hook})', detail: 'executor', documentation: 'Adds hook to raknet send, returns the hook to be used with raknet.remove_send_hook', insertTextRules: 4 },
  { label: 'raknet.remove_send_hook', kind: 1, insertText: 'raknet.remove_send_hook(${1:hook})', detail: 'executor', documentation: 'Removes hook from raknet send', insertTextRules: 4 },
  { label: 'raknet.send', kind: 1, insertText: 'raknet.send(${1:data}, ${2:priority}, ${3:reliability}, ${4:ordering_channel})', detail: 'executor', documentation: 'Sends data over raknet', insertTextRules: 4 },
  { label: 'raknet.add_receive_hook', kind: 1, insertText: 'raknet.add_receive_hook(${1:hook})', detail: 'executor', documentation: 'Adds hook to raknet receive, returns the hook to be used with raknet.remove_receive_hook', insertTextRules: 4 },
  { label: 'raknet.remove_receive_hook', kind: 1, insertText: 'raknet.remove_receive_hook(${1:hook})', detail: 'executor', documentation: 'Removes hook from raknet receive', insertTextRules: 4 },
  { label: 'raknet.receive', kind: 1, insertText: 'raknet.receive(${1:data})', detail: 'executor', documentation: 'Receives data over raknet', insertTextRules: 4 },
];

const executorDrawing: CompletionItem[] = [
  { label: 'Drawing.new', kind: 1, insertText: 'Drawing.new("${1:Line}")', detail: 'executor', documentation: 'Creates new Drawing object (Line, Circle, Square, Triangle, Text, Image, Quad)', insertTextRules: 4 },
  { label: 'cleardrawcache', kind: 1, insertText: 'cleardrawcache()', detail: 'executor', documentation: 'Removes all active drawing objects created with Drawing.new' },
  { label: 'getrenderproperty', kind: 1, insertText: 'getrenderproperty(${1:drawing}, ${2:property})', detail: 'executor', documentation: 'Retrieves the value of a property from a Drawing object', insertTextRules: 4 },
  { label: 'setrenderproperty', kind: 1, insertText: 'setrenderproperty(${1:drawing}, ${2:property}, ${3:value})', detail: 'executor', documentation: 'Assigns a value to a property of a Drawing object', insertTextRules: 4 },
  { label: 'isrenderobj', kind: 1, insertText: 'isrenderobj(${1:object})', detail: 'executor', documentation: 'Checks whether a given value is a valid Drawing object', insertTextRules: 4 },
  { label: 'Drawing Line', kind: 14, insertText: 'local ${1:line} = Drawing.new("Line")\n${1:line}.Visible = true\n${1:line}.From = Vector2.new(${2:0}, ${3:0})\n${1:line}.To = Vector2.new(${4:100}, ${5:100})\n${1:line}.Color = Color3.fromRGB(${6:255}, ${7:255}, ${8:255})\n${1:line}.Thickness = ${9:1}', detail: 'snippet', documentation: 'Create Drawing Line', insertTextRules: 4 },
  { label: 'Drawing Circle', kind: 14, insertText: 'local ${1:circle} = Drawing.new("Circle")\n${1:circle}.Visible = true\n${1:circle}.Position = Vector2.new(${2:0}, ${3:0})\n${1:circle}.Radius = ${4:50}\n${1:circle}.Color = Color3.fromRGB(${5:255}, ${6:255}, ${7:255})\n${1:circle}.Filled = ${8:false}\n${1:circle}.Thickness = ${9:1}', detail: 'snippet', documentation: 'Create Drawing Circle', insertTextRules: 4 },
  { label: 'Drawing Square', kind: 14, insertText: 'local ${1:square} = Drawing.new("Square")\n${1:square}.Visible = true\n${1:square}.Position = Vector2.new(${2:0}, ${3:0})\n${1:square}.Size = Vector2.new(${4:100}, ${5:100})\n${1:square}.Color = Color3.fromRGB(${6:255}, ${7:255}, ${8:255})\n${1:square}.Filled = ${9:false}\n${1:square}.Thickness = ${10:1}', detail: 'snippet', documentation: 'Create Drawing Square', insertTextRules: 4 },
  { label: 'Drawing Text', kind: 14, insertText: 'local ${1:text} = Drawing.new("Text")\n${1:text}.Visible = true\n${1:text}.Position = Vector2.new(${2:0}, ${3:0})\n${1:text}.Text = "${4:Hello}"\n${1:text}.Size = ${5:18}\n${1:text}.Color = Color3.fromRGB(${6:255}, ${7:255}, ${8:255})\n${1:text}.Center = ${9:false}\n${1:text}.Outline = ${10:true}', detail: 'snippet', documentation: 'Create Drawing Text', insertTextRules: 4 },
];

const executorWebsocket: CompletionItem[] = [
  { label: 'WebSocket.connect', kind: 1, insertText: 'WebSocket.connect(${1:url})', detail: 'executor', documentation: 'Connects to WebSocket server', insertTextRules: 4 },
  { label: 'WebSocket pattern', kind: 14, insertText: 'local socket = WebSocket.connect("${1:wss://example.com}")\n\nsocket.OnMessage:Connect(function(message)\n\t${2:print(message)}\nend)\n\nsocket.OnClose:Connect(function()\n\t${3:print("Disconnected")}\nend)\n\nsocket:Send("${4:Hello}")', detail: 'snippet', documentation: 'WebSocket connection pattern', insertTextRules: 4 },
];

const executorCrypt: CompletionItem[] = [
  { label: 'base64encode', kind: 1, insertText: 'base64encode(${1:data})', detail: 'executor', documentation: 'Encodes a string with Base64 encoding', insertTextRules: 4 },
  { label: 'base64decode', kind: 1, insertText: 'base64decode(${1:data})', detail: 'executor', documentation: 'Decodes a Base64-encoded string back into its original form', insertTextRules: 4 },
  { label: 'lz4compress', kind: 1, insertText: 'lz4compress(${1:data})', detail: 'executor', documentation: 'Compresses a string with the LZ4 compression algorithm', insertTextRules: 4 },
  { label: 'lz4decompress', kind: 1, insertText: 'lz4decompress(${1:data})', detail: 'executor', documentation: 'Decompresses a string that was encoded using the LZ4 compression algorithm', insertTextRules: 4 },
];

const allCompletions = [
  ...luaKeywords,
  ...robloxServices,
  ...globalFunctions,
  ...taskFunctions,
  ...instanceMethods,
  ...playersServiceMembers,
  ...playerMembers,
  ...constructors,
  ...snippets,
  ...mathCompletions,
  ...stringCompletions,
  ...tableCompletions,
  ...executorEnvironment,
  ...executorHooking,
  ...executorDebug,
  ...executorFilesystem,
  ...executorFiring,
  ...executorHttp,
  ...executorMisc,
  ...executorRacknet,
  ...executorDrawing,
  ...executorWebsocket,
  ...executorCrypt,
];

const KNOWN_NAMESPACES: Record<string, CompletionItem[]> = {
  math: mathCompletions,
  string: stringCompletions,
  table: tableCompletions,
  task: taskFunctions,
  debug: executorDebug.filter(i => i.label.startsWith('debug.')),
  raknet: executorRacknet,
  Drawing: executorDrawing,
  WebSocket: executorWebsocket,
};

const SERVICE_NAMES = new Set([
  'Players', 'Workspace', 'ReplicatedStorage', 'ReplicatedFirst',
  'ServerStorage', 'ServerScriptService', 'StarterGui', 'StarterPack',
  'StarterPlayer', 'Lighting', 'SoundService', 'TweenService',
  'RunService', 'UserInputService', 'ContextActionService', 'HttpService',
  'MarketplaceService', 'DataStoreService', 'MessagingService',
  'TeleportService', 'TextService', 'PathfindingService',
  'PhysicsService', 'CollectionService', 'Debris', 'Chat', 'Teams',
  'MemoryStoreService',
]);

const RICH_DOCS: Record<string, string> = {
  hookfunction: 'Hooks a function, replacing it with a custom handler while returning the original.\n\n```luau\nlocal original = hookfunction(targetFunc, function(...)\n\treturn original(...)\nend)\n```',
  request: 'Makes an HTTP request with full control over method, headers, and body.\n\n```luau\nlocal response = request({\n\tUrl = "https://api.example.com",\n\tMethod = "POST",\n\tHeaders = {["Content-Type"] = "application/json"},\n\tBody = HttpService:JSONEncode({key = "value"})\n})\nprint(response.StatusCode, response.Body)\n```',
  hookmetamethod: 'Hooks a metamethod on an object, useful for intercepting __index, __namecall, etc.\n\n```luau\nlocal old = hookmetamethod(game, "__namecall", newcclosure(function(self, ...)\n\tlocal method = getnamecallmethod()\n\tif method == "FireServer" then\n\t\tprint("Intercepted:", self:GetFullName())\n\tend\n\treturn old(self, ...)\nend))\n```',
  getconnections: 'Returns all signal connections, useful for debugging or disabling handlers.\n\n```luau\nfor _, conn in getconnections(game.Players.LocalPlayer.Idled) do\n\tconn:Disable()\nend\n```',
  'raknet.add_send_hook': 'Adds a hook to intercept outgoing raknet packets. The hook receives a RakNetMessage with AsBuffer, AsString, AsArray, Size, PacketId, Priority, Reliability, OrderingChannel properties, plus Block() and SetData() methods.\n\n```luau\nlocal hook = raknet.add_send_hook(function(message)\n\tprint(message.PacketId, message.Size)\n\tmessage:Block()\nend)\nraknet.remove_send_hook(hook)\n```',
  pcall: 'Protected call that catches errors without crashing.\n\n```luau\nlocal success, result = pcall(function()\n\treturn riskyOperation()\nend)\nif not success then\n\twarn("Error:", result)\nend\n```',
  'task.spawn': 'Runs a function immediately in a new coroutine thread.\n\n```luau\ntask.spawn(function()\n\twhile true do\n\t\ttask.wait(1)\n\t\tprint("tick")\n\tend\nend)\n```',
};

const POSTFIX_TRANSFORMS: Record<string, { detail: string; build: (expr: string) => string }> = {
  var: { detail: 'Extract to local variable', build: (e) => `local ${e} = ${e}` },
  ['if']: { detail: 'Wrap in if-then', build: (e) => `if ${e} then\n\t\${0}\nend` },
  ['not']: { detail: 'Negate expression', build: (e) => `not ${e}` },
  print: { detail: 'Print expression', build: (e) => `print(${e})` },
  pcall: { detail: 'Wrap in pcall', build: (e) => `local success, result = pcall(${e})` },
  type: { detail: 'Get type of expression', build: (e) => `type(${e})` },
  typeof: { detail: 'Get Roblox type', build: (e) => `typeof(${e})` },
  tostring: { detail: 'Convert to string', build: (e) => `tostring(${e})` },
};

const BLOCK_KEYWORDS = new Set(['end', 'else', 'elseif', 'then', 'until', 'do']);

function isKeywordRelevant(keyword: string, textBeforeCursor: string, lineIndex: number): boolean {
  const trimmed = textBeforeCursor.trim();
  if (BLOCK_KEYWORDS.has(keyword) && lineIndex === 0 && !trimmed) return false;
  if (keyword === 'then' && !/\bif\b/.test(trimmed) && !/\belseif\b/.test(trimmed)) return false;
  if (keyword === 'do' && !/\b(for|while)\b/.test(trimmed)) return false;
  if (keyword === 'until' && !trimmed) return false;
  if (keyword === 'else' && !trimmed && lineIndex === 0) return false;
  if (keyword === 'elseif' && !trimmed && lineIndex === 0) return false;
  return true;
}

function buildClassMemberSuggestion(
  monaco: typeof Monaco,
  member: ClassMember,
  range: Monaco.IRange,
  index: number,
): Monaco.languages.CompletionItem {
  const kind = member.kind === 'method'
    ? monaco.languages.CompletionItemKind.Method
    : member.kind === 'event'
      ? (monaco.languages.CompletionItemKind as unknown as Record<string, number>).Event ?? monaco.languages.CompletionItemKind.Property
      : monaco.languages.CompletionItemKind.Property;

  let insertText = member.name;
  let insertTextRules: Monaco.languages.CompletionItemInsertTextRule | undefined;

  if (member.kind === 'method' && member.args) {
    insertText = `${member.name}(${member.args})`;
    insertTextRules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
  } else if (member.kind === 'method') {
    insertText = `${member.name}()`;
  }

  const detail = member.kind === 'method'
    ? 'method'
    : member.kind === 'event'
      ? 'event'
      : member.valueType ?? 'property';

  return {
    label: member.name,
    kind,
    insertText,
    insertTextRules,
    detail,
    documentation: member.documentation,
    range,
    sortText: `1_${String(index).padStart(4, '0')}`,
  };
}

export function registerLuauCompletionProvider(monaco: typeof Monaco): Monaco.IDisposable {
  monaco.editor.registerCommand('synapsez.trackUsage', (_accessor: unknown, label: string) => {
    recordUsage(label);
  });

  return monaco.languages.registerCompletionItemProvider(LUAU_LANGUAGE_ID, {
    triggerCharacters: ['.', ':'],

    provideCompletionItems(model, position): Monaco.languages.ProviderResult<Monaco.languages.CompletionList> {
      const word = model.getWordUntilPosition(position);
      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      const addTracking = (item: Monaco.languages.CompletionItem): Monaco.languages.CompletionItem => ({
        ...item,
        command: { id: 'synapsez.trackUsage', title: '', arguments: [typeof item.label === 'string' ? item.label : ''] },
      });

      const isInsideString = (() => {
        let inSingle = false;
        let inDouble = false;
        for (let i = 0; i < textBeforeCursor.length; i++) {
          const ch = textBeforeCursor[i];
          if (ch === '\\') { i++; continue; }
          if (ch === '"' && !inSingle) inDouble = !inDouble;
          if (ch === "'" && !inDouble) inSingle = !inSingle;
        }
        return inSingle || inDouble;
      })();

      const getServiceInnerMatch = textBeforeCursor.match(/game\s*:\s*GetService\s*\(\s*["'](\w*)$/);
      if (getServiceInnerMatch) {
        const partial = getServiceInnerMatch[1].toLowerCase();
        const serviceNames = robloxServices.map(s => s.label).filter(n => n.toLowerCase().startsWith(partial));
        const quoteChar = textBeforeCursor[textBeforeCursor.length - partial.length - 1] || '"';
        const closeChar = quoteChar === "'" ? "')" : '")';
        return {
          suggestions: serviceNames.map(name => addTracking({
            label: name,
            kind: monaco.languages.CompletionItemKind.Value,
            insertText: `${name}${closeChar}`,
            detail: 'Service',
            documentation: `game:GetService("${name}")`,
            range,
            sortText: `0_${name}`,
            filterText: name,
          })),
        };
      }

      if (isInsideString) {
        return { suggestions: [] };
      }

      const fullText = model.getValue();
      const scopeVars = analyzeScope(fullText, position.lineNumber);

      const dotPrefixMatch = textBeforeCursor.match(/(\w+)\.\w*$/);
      const colonPrefixMatch = textBeforeCursor.match(/(\w+):(\w*)$/);
      const dotPrefix = dotPrefixMatch ? dotPrefixMatch[1] : null;

      const applyBoost = (items: Monaco.languages.CompletionItem[]): Monaco.languages.CompletionItem[] =>
        items.map(item => {
          const label = typeof item.label === 'string' ? item.label : '';
          const boost = getUsageBoost(label);
          if (boost > 0) {
            const priority = String(Math.max(0, 50 - Math.floor(boost * 5))).padStart(3, '0');
            return addTracking({ ...item, sortText: `0_${priority}_${label}` });
          }
          return addTracking(item);
        });

      const enrichDoc = (item: Monaco.languages.CompletionItem): Monaco.languages.CompletionItem => {
        const label = typeof item.label === 'string' ? item.label : '';
        const rich = RICH_DOCS[label];
        if (rich) return { ...item, documentation: { value: rich } };
        return item;
      };

      const finalize = (items: Monaco.languages.CompletionItem[]): Monaco.languages.CompletionItem[] =>
        applyBoost(items.map(enrichDoc));

      if (colonPrefixMatch && !dotPrefixMatch) {
        const varName = colonPrefixMatch[1];
        const resolvedType = resolveChainType(varName, scopeVars);

        if (resolvedType && isKnownClass(resolvedType)) {
          const members = getClassMembers(resolvedType).filter(m => m.kind === 'method');
          return { suggestions: finalize(members.map((m, i) => buildClassMemberSuggestion(monaco, m, range, i))) };
        }

        const fallbackMethods = instanceMethods.map((item) => ({
          label: item.label,
          kind: item.kind,
          insertText: item.insertText,
          insertTextRules: item.insertTextRules,
          detail: item.detail,
          documentation: item.documentation,
          range,
          sortText: `1_${item.label}`,
        }));
        return { suggestions: finalize(fallbackMethods) };
      }

      if (textBeforeCursor.endsWith('game:GetService(')) {
        const serviceNames = robloxServices.map(s => s.label);
        return {
          suggestions: serviceNames.map(name => addTracking({
            label: name,
            kind: monaco.languages.CompletionItemKind.Value,
            insertText: `"${name}")`,
            detail: 'Service',
            range,
            filterText: name,
          })),
        };
      }

      const eventConnectMatch = textBeforeCursor.match(/\.(\w+)\s*:\s*Connect\s*\(\s*function\s*\(\s*$/);
      if (eventConnectMatch) {
        const eventName = eventConnectMatch[1];
        const params = getEventParamNames(eventName);
        if (params && params.length > 0) {
          const paramText = params.join(', ');
          return {
            suggestions: [{
              label: paramText,
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: `${paramText})`,
              detail: `${eventName} parameters`,
              documentation: `Suggested parameter names for ${eventName}`,
              range,
              sortText: '0_000',
            }],
          };
        }
      }

      if (dotPrefix) {
        const postfixWord = word.word;
        if (postfixWord && POSTFIX_TRANSFORMS[postfixWord]) {
          const exprMatch = textBeforeCursor.match(/(\w+)\.\w*$/);
          if (exprMatch) {
            const expr = exprMatch[1];
            const replaceRange: Monaco.IRange = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: position.column - expr.length - 1 - postfixWord.length,
              endColumn: position.column,
            };

            const results: Monaco.languages.CompletionItem[] = [];
            for (const [name, transform] of Object.entries(POSTFIX_TRANSFORMS)) {
              const built = transform.build(expr);
              const isSnippet = built.includes('${');
              results.push(addTracking({
                label: `.${name}`,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: built,
                insertTextRules: isSnippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                detail: transform.detail,
                documentation: `${expr}.${name} → ${transform.build(expr).replace(/\$\{\d+\}/g, '...')}`,
                range: replaceRange,
                sortText: `0_postfix_${name}`,
                filterText: name,
              }));
            }
            return { suggestions: results };
          }
        }

        const nsItems = KNOWN_NAMESPACES[dotPrefix];
        if (nsItems) {
          const items: Monaco.languages.CompletionItem[] = nsItems.map((item) => {
            let insertText = item.insertText;
            if (item.insertText.startsWith(dotPrefix + '.')) {
              insertText = item.insertText.substring(dotPrefix.length + 1);
            }
            const memberName = item.label.includes('.') ? item.label.substring(dotPrefix.length + 1) : item.label;
            return {
              label: item.label,
              kind: item.kind,
              insertText,
              insertTextRules: item.insertTextRules,
              detail: item.detail,
              documentation: item.documentation,
              range,
              sortText: `1_${item.label}`,
              filterText: memberName,
            };
          });
          return { suggestions: finalize(items) };
        }

        const resolvedType = resolveChainType(dotPrefix, scopeVars);
        if (resolvedType && isKnownClass(resolvedType)) {
          const members = getClassMembers(resolvedType);
          return { suggestions: finalize(members.map((m, i) => buildClassMemberSuggestion(monaco, m, range, i))) };
        }

        const buildDotSuggestions = (items: CompletionItem[]): Monaco.languages.CompletionItem[] => items.map((item) => {
          let insertText = item.insertText;
          let filterText = item.filterText;
          if (item.label.startsWith(dotPrefix + '.')) {
            const memberName = item.label.substring(dotPrefix.length + 1);
            if (item.insertText.startsWith(dotPrefix + '.')) {
              insertText = item.insertText.substring(dotPrefix.length + 1);
            }
            filterText = memberName;
          }
          return {
            label: item.label,
            kind: item.kind,
            insertText,
            insertTextRules: item.insertTextRules,
            detail: item.detail,
            documentation: item.documentation,
            range,
            sortText: item.sortText ?? `1_${item.label}`,
            filterText,
          };
        });

        const ngramSuggestions = buildNGram(model, position, word, range, monaco);
        const dotSuggestions = buildDotSuggestions(allCompletions);
        const seen = new Set(dotSuggestions.map(s => s.label));
        const merged = [...ngramSuggestions.filter(s => !seen.has(s.label)), ...dotSuggestions];
        return { suggestions: finalize(merged) };
      }

      const buildPlain = (items: CompletionItem[]): Monaco.languages.CompletionItem[] => items.map((item) => ({
        label: item.label,
        kind: item.kind,
        insertText: item.insertText,
        insertTextRules: item.insertTextRules,
        detail: item.detail,
        documentation: item.documentation,
        range,
        sortText: item.sortText ?? `1_${item.label}`,
        filterText: item.filterText,
      }));

      const ngramSuggestions = buildNGram(model, position, word, range, monaco);

      const filteredKeywords = luaKeywords.filter(k => isKeywordRelevant(k.label, textBeforeCursor, position.lineNumber - 1));
      const nonKeywordItems = allCompletions.filter(i => i.kind !== 13);

      const scopeItems: Monaco.languages.CompletionItem[] = scopeVars
        .filter(v => v.name !== 'game' && v.name !== 'workspace' && v.name !== 'script')
        .map((v, i) => ({
          label: v.name,
          kind: v.isParam ? monaco.languages.CompletionItemKind.Variable : monaco.languages.CompletionItemKind.Variable,
          insertText: v.name,
          detail: v.inferredType ? `${v.inferredType} (local)` : 'local',
          range,
          sortText: `0_scope_${String(i).padStart(4, '0')}`,
        }));

      const serviceSnippets: Monaco.languages.CompletionItem[] = [];
      const trimmedLine = textBeforeCursor.trim();
      if (!trimmedLine || trimmedLine === 'local') {
        for (const svc of SERVICE_NAMES) {
          const alreadyDeclared = scopeVars.some(v => v.name === svc);
          if (alreadyDeclared) continue;
          serviceSnippets.push({
            label: `${svc} (service)`,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: `local ${svc} = game:GetService("${svc}")`,
            detail: 'auto-import service',
            documentation: `Declares local ${svc} with GetService`,
            range: trimmedLine === 'local'
              ? { ...range, startColumn: range.startColumn - 6 }
              : range,
            sortText: `1_service_${svc}`,
            filterText: svc,
          });
        }
      }

      const base = buildPlain([...filteredKeywords, ...nonKeywordItems]);
      const seen = new Set(base.map(s => typeof s.label === 'string' ? s.label : ''));
      const extras = [
        ...scopeItems.filter(s => !seen.has(typeof s.label === 'string' ? s.label : '')),
        ...serviceSnippets,
        ...ngramSuggestions.filter(s => !seen.has(typeof s.label === 'string' ? s.label : '')),
      ];

      return { suggestions: finalize([...extras, ...base]) };
    },
  });
}

function buildNGram(
  model: Monaco.editor.ITextModel,
  position: Monaco.IPosition,
  word: Monaco.editor.IWordAtPosition,
  range: Monaco.IRange,
  monaco: typeof Monaco,
): Monaco.languages.CompletionItem[] {
  const prefix = word.word;
  const items = getNGramSuggestions(model, position, prefix, NGRAM_CONFIG);
  return items.map((item, index) => ({
    label: item.label,
    kind: item.source === 'identifier'
      ? monaco.languages.CompletionItemKind.Variable
      : monaco.languages.CompletionItemKind.Text,
    insertText: item.label,
    detail: item.source === 'identifier' ? 'identifier' : 'context',
    range,
    sortText: `${NGRAM_SORT_PREFIX}${String(1000 - index).padStart(4, '0')}`,
  }));
}
