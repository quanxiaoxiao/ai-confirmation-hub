# Health endpoint contract test

GET {{host}}/health
HTTP 200
[Asserts]
jsonpath "$.ok" isBoolean
jsonpath "$.watcher" exists
jsonpath "$.watcher.running" isBoolean
jsonpath "$.watcher.errorCount" isInteger
jsonpath "$.store" exists
jsonpath "$.store.ok" == true
