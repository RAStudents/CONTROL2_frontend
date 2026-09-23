# Acmenra Edge → CONTROL Contracts

Контракты разделяют два разных класса данных, которые Edge передаёт в CONTROL:

1. **Event** — бизнес-событие и контекст, в котором оно произошло.
2. **Telemetry** — техническое состояние Edge-устройства.

Они не должны смешиваться.

```text
                 ┌── Event
                 │    ├── event context
                 │    ├── inference
                 │    ├── media
                 │    ├── device snapshot
                 │    └── performance
                 │
EDGE ────────────┤
                 │
                 └── Heartbeat / Telemetry
                      ├── CPU
                      ├── GPU
                      ├── RAM
                      ├── temperature
                      ├── disk
                      └── network
```

## 1. Event

`Event` описывает факт, который имеет бизнесовый или прикладной смысл.

Примеры:

* `sleeping`
* `fall`
* `ppe_missing`
* `intrusion`
* `person_detected`
* `vehicle_entered`

Главное правило:

> Event должен позволять CONTROL понять не только, что произошло, но и в каком контексте это произошло.

Поэтому Event содержит:

* идентичность события;
* время;
* устройство;
* business binding;
* источник изображения;
* модель и её версию;
* результат inference;
* media;
* snapshot состояния устройства;
* performance;
* дополнительные данные конкретного события.

## 2. Telemetry

`Telemetry` не описывает бизнес-событие.

Она отвечает на другой вопрос:

> «В каком техническом состоянии сейчас находится Edge-устройство?»

Telemetry может отправляться независимо от Event.

Например, устройство может не обнаруживать ни одного события, но CONTROL всё равно должен знать:

* работает ли CPU;
* не перегревается ли устройство;
* сколько занято RAM;
* сколько занято GPU;
* сколько свободного диска;
* какой FPS приходит с камеры;
* какой FPS реально обрабатывается;
* не выросла ли inference latency;
* есть ли проблемы с сетью.

## 3. Device Snapshot внутри Event

`device_snapshot` — это не замена Telemetry.

Это контекст конкретного события.

Например:

```text
18:09:53 — sleeping
18:09:53 — CPU 74%
18:09:53 — GPU 82%
18:09:53 — RAM 73%
18:09:53 — inference 43 ms
```

Это позволяет позже анализировать событие с учётом состояния Edge.

Snapshot не обязан присутствовать в каждом событии.

Если Edge генерирует большое количество событий, постоянную техническую информацию следует передавать через Telemetry, а snapshot использовать для значимых событий или по настроенной политике.

## 4. Performance

`performance` описывает не состояние железа, а состояние CV pipeline.

Например:

```text
capture
  ↓
preprocess
  ↓
inference
  ↓
postprocess
  ↓
event
```

Для диагностики важно различать:

* `capture_latency_ms`;
* `preprocess_latency_ms`;
* `inference_latency_ms`;
* `postprocess_latency_ms`;
* `total_latency_ms`;
* `fps_input`;
* `fps_processed`.

Это позволяет отличать проблему модели от проблемы железа или входного видеопотока.

Например, рост `inference_latency_ms` вместе с ростом GPU usage может указывать на нагрузку на вычислительный ресурс, тогда как падение `fps_input` при нормальной inference latency указывает уже на другую часть pipeline.

## 5. Event time и CONTROL time

Edge и CONTROL имеют разные временные точки.

`occurred_at` — когда событие произошло на Edge.

`started_at` / `ended_at` — временные границы события, если оно имеет длительность.

`received_at` — когда CONTROL получил событие.

`received_at` должен формироваться на стороне CONTROL.

Это позволяет различать:

```text
event occurred
      ↓
Edge processing
      ↓
network
      ↓
CONTROL received
```

и анализировать задержки доставки отдельно от времени самого события.

## 6. Idempotency

Edge может потерять соединение после отправки события и повторить отправку.

Поэтому событие должно иметь стабильный `idempotency_key`.

Повторная доставка:

```text
EVENT A
   ↓
request
   ↓
timeout
   ↓
retry
   ↓
same EVENT A
```

не должна создавать два бизнес-события в CONTROL.

`idempotency_key` должен оставаться неизменным при retry.

## 7. Что не входит в Event

В Event не следует передавать состояние Outbox:

```text
attempts
last_error
retry_after_at
last_attempt_at
consecutive_attempts
```

Это техническое состояние доставки на Edge.

Оно относится к:

```text
Edge Outbox
```

а не к:

```text
Acmenra Event
```

CONTROL должен получать факт события, а не историю попыток HTTP-доставки.

## 8. Что не следует делать обязательным

Edge-устройства могут иметь разное оборудование.

Поэтому технические поля, которые физически отсутствуют на конкретном устройстве, могут иметь значение `null`.

Например:

```json
{
  "gpu": {
    "usage_percent": null,
    "temperature_c": null,
    "memory_usage_percent": null
  }
}
```

Это означает:

> GPU отсутствует или соответствующая метрика недоступна.

`null` не должен означать:

> значение равно нулю.

Поэтому:

* `0` = метрика реально равна нулю;
* `null` = метрика неизвестна/неприменима/недоступна.

## 9. Что нельзя использовать как идентификатор

Следующие значения не должны быть основным идентификатором сущности:

* hostname;
* project path;
* camera name;
* внешний ID;
* IP address.

Для устройства используется `device.id`.

Для события используется `event.id`.

Для защиты от повторной доставки используется `event.idempotency_key`.

## 10. Media

Media не передаётся внутри события как base64.

Event содержит ссылку на объект в media storage:

```text
events/{event_id}/preview.jpg
events/{event_id}/incident.mp4
```

Конкретный механизм хранения и доступа к media является отдельным контрактом.

## 11. Inference

CONTROL не должен зависеть от конкретного ML backend.

Event может быть получен независимо от того, выполнялся inference через:

* Ultralytics/YOLO;
* ONNX Runtime;
* TensorRT;
* OpenVINO;
* другой backend.

На уровне Event передаётся унифицированный результат.

Геометрия объектов должна соответствовать единому контракту `acmenra-cv`, а не иметь отдельную несовместимую реализацию только для CONTROL.

## 12. Payload

`payload` предназначен для дополнительных данных конкретного типа события.

Например:

```json
{
  "payload": {
    "frames_count": 60
  }
}
```

Но `payload` нельзя превращать в произвольную свалку всех возможных данных.

Если какое-либо поле становится общим для системы, оно должно быть вынесено в основной контракт.

Например, если `frames_count` начинает использоваться почти каждым Event, его можно сделать стандартным полем.

## 13. Два потока данных

Таким образом, Edge имеет два независимых направления:

### Event

```text
Edge
 ↓
Event
 ↓
Outbox
 ↓
CONTROL
```

Event содержит:

```text
identity
time
device
binding
source
model
inference
media
device_snapshot
performance
payload
```

### Telemetry

```text
Edge
 ↓
Heartbeat / Telemetry
 ↓
CONTROL
```

Telemetry содержит:

```text
CPU
GPU
RAM
temperature
storage
network
FPS
latency
```

## 14. Главное правило архитектуры

**Event отвечает на вопрос «что произошло?»**

**Telemetry отвечает на вопрос «в каком состоянии находится устройство?»**

**Device Snapshot связывает эти два мира в конкретный момент события.**

**Outbox отвечает только за доставку.**

Эти четыре понятия не следует смешивать в одну модель.

## 15. Минимальная архитектура

В результате поток выглядит так:

```text
                 ┌──────────────────────────┐
                 │          EVENT           │
                 │                          │
                 │ event                    │
                 │ device                   │
                 │ binding                  │
                 │ source                   │
                 │ model                    │
                 │ inference                │
                 │ media                    │
                 │ device_snapshot          │
                 │ performance              │
                 │ payload                  │
                 └────────────┬─────────────┘
                              │
                              ▼
EDGE ────────────────────── OUTBOX ────────► CONTROL
                             
                 ┌──────────────────────────┐
                 │       TELEMETRY          │
                 │                          │
                 │ CPU                      │
                 │ GPU                      │
                 │ RAM                      │
                 │ temperature              │
                 │ storage                  │
                 │ network                  │
                 │ performance              │
                 └────────────┬─────────────┘
                              │
                              └──────────────► CONTROL
```

Это разделение является базовым принципом контракта Edge → CONTROL.
