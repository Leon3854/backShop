"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUserId = generateUserId;
exports.generateEventId = generateEventId;
const uuid_1 = require("uuid");
function generateUserId() {
    return (0, uuid_1.v4)();
}
function generateEventId() {
    return (0, uuid_1.v4)();
}
