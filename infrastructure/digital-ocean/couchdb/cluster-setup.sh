export PASSWD=a8c3c992-ff89-11ed-a2e7-4a356672aa64

curl -X POST -H "Content-Type: application/json" http://admin:$PASSWD@170.64.136.235:5984/_cluster_setup -d '{"action": "enable_cluster", "bind_address":"0.0.0.0", "username": "admin", "password":"$PASSWD", "node_count":"3"}'
curl -X POST -H "Content-Type: application/json" http://admin:$PASSWD@170.64.220.49:5984/_cluster_setup -d '{"action": "enable_cluster", "bind_address":"0.0.0.0", "username": "admin", "password":"$PASSWD", "node_count":"3"}'
curl -X POST -H "Content-Type: application/json" http://admin:$PASSWD@170.64.160.207:5984/_cluster_setup -d '{"action": "enable_cluster", "bind_address":"0.0.0.0", "username": "admin", "password":"$PASSWD", "node_count":"3"}'

curl http://admin:$PASSWD@170.64.160.207:5984/_cluster_setup

curl -X PUT "http://admin:$PASSWD@170.64.136.235:5984/_node/_local/_nodes/couchdb@10.126.0.4" -d '{"port":5984}'
curl -X PUT "http://admin:$PASSWD@170.64.136.235:5984/_node/_local/_nodes/couchdb@10.126.0.5" -d '{"port":5984}'

curl -X POST -H "Content-Type: application/json" http://admin:$PASSWD@170.64.136.235:5984/_cluster_setup -d '{"action": "finish_cluster"}'

curl http://admin:$PASSWD@170.64.136.235:5984/_cluster_setup