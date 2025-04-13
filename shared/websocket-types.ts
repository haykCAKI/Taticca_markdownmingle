export enum MessageType {
  JOIN_DOCUMENT = 'JOIN_DOCUMENT',
  LEAVE_DOCUMENT = 'LEAVE_DOCUMENT',
  UPDATE_CONTENT = 'UPDATE_CONTENT',
  UPDATE_TITLE = 'UPDATE_TITLE',
  CLIENT_COUNT_UPDATE = 'CLIENT_COUNT_UPDATE',
  ERROR = 'ERROR',
}

export interface BaseMessage {
  type: MessageType;
}

export interface JoinDocumentMessage extends BaseMessage {
  type: MessageType.JOIN_DOCUMENT;
  documentId: string;
}

export interface LeaveDocumentMessage extends BaseMessage {
  type: MessageType.LEAVE_DOCUMENT;
  documentId: string;
}

export interface UpdateContentMessage extends BaseMessage {
  type: MessageType.UPDATE_CONTENT;
  documentId: string;
  content: string;
  cursor?: { line: number; column: number };
}

export interface UpdateTitleMessage extends BaseMessage {
  type: MessageType.UPDATE_TITLE;
  documentId: string;
  title: string;
}

export interface ClientCountUpdateMessage extends BaseMessage {
  type: MessageType.CLIENT_COUNT_UPDATE;
  documentId: string;
  count: number;
}

export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  message: string;
}

export type WebSocketMessage =
  | JoinDocumentMessage
  | LeaveDocumentMessage
  | UpdateContentMessage
  | UpdateTitleMessage
  | ClientCountUpdateMessage
  | ErrorMessage;
