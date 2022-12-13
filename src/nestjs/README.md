# This package is for turning smart-router into a server

# Get example

## bscTest(BMOS) -> NearTest(WNEAR)
`http://127.0.0.1:9009/router/best_route?fromChainId=97&toChainId=5566818579631833089&amountIn=1000&tokenInAddress=0x593F6F6748dc203DFa636c299EeA6a39C0734EEd&tokenInDecimal=18&tokenOutAddress=wrap.testnet&tokenOutDecimal=6&tokenOutSymbol=WNEAR&tokenInSymbol=BMOS`

## NearTest(WNEAR) -> bscTest(BMOS)
`http://127.0.0.1:9009/router/best_route?fromChainId=5566818579631833089&toChainId=97&amountIn=1000&tokenInAddress=wrap.testnet&tokenInDecimal=6&tokenOutAddress=0x593F6F6748dc203DFa636c299EeA6a39C0734EEd&tokenOutDecimal=18&tokenOutSymbol=BMOS&tokenInSymbol=WNEAR`

## bscTest(BMOS) -> PolygonTest(PMOS)
`http://127.0.0.1:9009/router/best_route?fromChainId=97&toChainId=80001&amountIn=1000&tokenInAddress=0x593F6F6748dc203DFa636c299EeA6a39C0734EEd&tokenInDecimal=18&tokenOutAddress=0xe1D8eAB4e616156E11e1c59D1a0E0EFeD66f4cfa&tokenOutDecimal=18&tokenOutSymbol=PMOS&tokenInSymbol=BMOS`

## PolygonTest(PMOS) -> bscTest(BMOS)
`http://127.0.0.1:9009/router/best_route?fromChainId=80001&toChainId=97&amountIn=1000&tokenInAddress=0xe1D8eAB4e616156E11e1c59D1a0E0EFeD66f4cfa&tokenInDecimal=18&tokenOutAddress=0x593F6F6748dc203DFa636c299EeA6a39C0734EEd&tokenOutDecimal=18&tokenOutSymbol=BMOS&tokenInSymbol=PMOS`

## bscTest(WBNB) -> PolygonTest(WMATIC)
`http://127.0.0.1:9009/router/best_route?fromChainId=97&toChainId=80001&amountIn=1000&tokenInAddress=0x0000000000000000000000000000000000000000&tokenInDecimal=18&tokenOutAddress=0x0000000000000000000000000000000000000000&tokenOutDecimal=18&tokenOutSymbol=WMATIC&tokenInSymbol=WBNB`

## PolygonTest(WMATIC) -> bscTest(WBNB)
`http://127.0.0.1:9009/router/best_route?fromChainId=80001&toChainId=97&amountIn=1000&tokenInAddress=0x0000000000000000000000000000000000000000&tokenInDecimal=18&tokenOutAddress=0x0000000000000000000000000000000000000000&tokenOutDecimal=18&tokenOutSymbol=WBNB&tokenInSymbol=WMATIC`

## mapTest(WMAP) -> PolygonTest(WMATIC)
`http://127.0.0.1:9009/router/best_route?fromChainId=212&toChainId=80001&amountIn=1.1&tokenInAddress=0x424D3bcdC96F42aC919F276D7D4f6C94f24e0703&tokenInDecimal=18&tokenOutAddress=0x0000000000000000000000000000000000000000&tokenOutDecimal=18&tokenOutSymbol=WMATIC&tokenInSymbol=WMAP`

## bscTest(WBNB) -> mapTest(WMAP)
`http://127.0.0.1:9009/router/best_route?fromChainId=97&toChainId=212&amountIn=1000&tokenInAddress=0x0000000000000000000000000000000000000000&tokenInDecimal=18&tokenOutAddress=0x424D3bcdC96F42aC919F276D7D4f6C94f24e0703&tokenOutDecimal=18&tokenOutSymbol=WMAP&tokenInSymbol=WBNB`