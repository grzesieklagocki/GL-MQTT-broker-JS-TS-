import { IMQTTReaderV4, SubscriptionV4 } from "@src/mqtt/protocol/v4/types";
import { vi } from "vitest";

// Create a mock reader for CONNACK packets
export function createConnackReaderMock(
  remaining: number,
  sessionPresentFlag: number,
  returnCode: number
) {
  return createIMQTTReaderV4Mock(
    [remaining],
    [sessionPresentFlag, returnCode],
    [],
    []
  );
}

// Create a mock reader for SUBACK packets
export function createSubackReaderMock(
  remaining: number,
  identifier: number,
  returnCode: number
) {
  return createIMQTTReaderV4Mock(
    [remaining],
    [returnCode],
    [identifier],
    [] // not used in SUBACK packets
  );
}

// Create a mock reader for UNSUBSCRIBE packets
export function createUnsubscribeReaderMock(
  remainingValues: number[],
  identifier: number,
  topicFilters: string[]
) {
  return createIMQTTReaderV4Mock(
    remainingValues,
    [], // not used in UNSUBSCRIBE packet
    [identifier],
    topicFilters
  );
}

// Create a mock reader for SUBSCRIBE packets
export function createSubscribeReaderMock(
  remainingValues: number[],
  identifier: number,
  subscriptionList: SubscriptionV4[]
) {
  return createIMQTTReaderV4Mock(
    remainingValues,
    subscriptionList.map((sub) => sub[1]),
    [identifier],
    subscriptionList.map((sub) => sub[0])
  );
}

// Create a mock reader for PUBLISH packets
export function createPublishReaderMock(
  remainingValues: number[],
  topicName: string,
  identifier: number,
  message: Uint8Array
) {
  return createIMQTTReaderV4Mock(
    remainingValues,
    [],
    [identifier],
    [topicName],
    [message]
  );
}

// Create mock for tests of MQTT v4 parsers
function createIMQTTReaderV4Mock(
  remainingReturnValues: number[],
  read1BIntReturnValues: number[],
  read2BIntReturnValues: number[],
  readStringReturnValues: string[],
  readBytesReturnValues?: Uint8Array[]
) {
  const mock = {
    readOneByteInteger: createMockWithReturnValues(read1BIntReturnValues),
    readTwoByteInteger: createMockWithReturnValues(read2BIntReturnValues),
    readString: createMockWithReturnValues(readStringReturnValues),
    readBytes: readBytesReturnValues
      ? createMockWithReturnValues(readBytesReturnValues)
      : [],
  } as unknown as IMQTTReaderV4;

  setRemainingReturnValues(mock, remainingReturnValues);

  return mock;
}

// Helper to create a mock function that throws an error with the provided message
export const getErrorMock = (message: string) =>
  vi.fn().mockImplementationOnce(() => {
    throw new Error(message);
  });

// Helper to set the return values of the `remaining` getter
function setRemainingReturnValues(
  readerMock: IMQTTReaderV4,
  returnValues: number[]
) {
  const mockFunction = vi.fn();

  returnValues.forEach((value) => mockFunction.mockReturnValueOnce(value));

  Object.defineProperty(readerMock, "remaining", {
    get: mockFunction,
  });
}

// Helper to create a mock function that returns specified values (in order)
function createMockWithReturnValues<T>(values: T[]) {
  const mock = vi.fn();

  values.forEach((value) => mock.mockReturnValueOnce(value));

  return mock;
}
